import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has call-centre permissions or provider view permissions
    const hasCallCentrePermission = await checkPermission(session.user.role as any, "call-centre", "view")
    const hasProviderPermission = await checkPermission(session.user.role as any, "provider", "view")
    if (!hasCallCentrePermission && !hasProviderPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const enrolleeId = searchParams.get("enrollee_id")
    const search = searchParams.get("search") || ""
    const facilityType = searchParams.get("facility_type") || ""

    if (!enrolleeId) {
      return NextResponse.json({ error: "Enrollee ID is required" }, { status: 400 })
    }

    // Get enrollee details with plan and bands
    const enrollee = await prisma.principalAccount.findFirst({
      where: { enrollee_id: enrolleeId },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            assigned_bands: true,
            band_type: true
          }
        }
      }
    })

    if (!enrollee) {
      return NextResponse.json({ error: "Enrollee not found" }, { status: 404 })
    }

    if (!enrollee.plan) {
      return NextResponse.json({ 
        error: "Enrollee has no active plan",
        status: "NO_PLAN"
      }, { status: 400 })
    }

    const normalizeBand = (band: string): string => {
      const trimmed = band?.toLowerCase().trim()
      if (!trimmed) return ""
      if (trimmed === "a" || trimmed === "band a") return "Band A"
      if (trimmed === "b" || trimmed === "band b") return "Band B"
      if (trimmed === "c" || trimmed === "band c") return "Band C"
      return band
    }

    const getAccessibleBands = (band: string): string[] => {
      const normalized = normalizeBand(band)
      switch (normalized) {
        case "Band A":
          return ["Band A", "Band B", "Band C"]
        case "Band B":
          return ["Band B", "Band C"]
        case "Band C":
          return ["Band C"]
        default:
          return [normalized]
      }
    }

    const enrolleeBands = enrollee.plan.assigned_bands && enrollee.plan.assigned_bands.length > 0
      ? enrollee.plan.assigned_bands.map(normalizeBand).filter(Boolean)
      : (enrollee.plan.band_type ? [normalizeBand(enrollee.plan.band_type)].filter(Boolean) : [])

    console.log("Enrollee bands for provider access:", enrolleeBands)

    // Build where clause for providers
    const where: any = {
      status: "ACTIVE"
    }

    // Filter by search term
    if (search) {
      where.facility_name = {
        contains: search,
        mode: 'insensitive'
      }
    }

    // Filter by facility type
    if (facilityType && facilityType !== 'all') {
      where.facility_type = facilityType
    }

    const accessibleBandsSet = new Set<string>()
    enrolleeBands.forEach(band => {
      getAccessibleBands(band).forEach(accessibleBand => {
        if (accessibleBand) {
          accessibleBandsSet.add(accessibleBand)
        }
      })
    })
    const accessibleBands = Array.from(accessibleBandsSet)
    const selectedBandOptions = Array.from(new Set(accessibleBands.flatMap(band => {
      const alias = band.replace(/^[Bb]and\s+/i, "").toUpperCase()
      return alias ? [band, alias] : [band]
    })))

    console.log("[Band Access] Accessible bands:", accessibleBands)

    const providerWhere = {
      ...where,
      ...(accessibleBands.length > 0
        ? {
            AND: [
              ...(where.AND || []),
              {
                OR: [
                  {
                    plan_bands: {
                      some: {
                        plan_id: enrollee.plan.id,
                        status: "ACTIVE",
                        band_type: {
                          in: accessibleBands
                        }
                      }
                    }
                  },
                  {
                    selected_bands: {
                      hasSome: selectedBandOptions
                    }
                  }
                ]
              }
            ]
          }
        : {})
    }

    const accessibleProviders = await prisma.provider.findMany({
      where: providerWhere,
      include: {
        plan_bands: {
          where: {
            plan_id: enrollee.plan.id,
            status: 'ACTIVE',
            ...(accessibleBands.length > 0 ? { band_type: { in: accessibleBands } } : {})
          },
          select: {
            band_type: true
          }
        }
      },
      orderBy: {
        facility_name: 'asc'
      }
    })

    // Format providers with band information
    const formattedProviders = accessibleProviders.map(provider => {
      // Get the bands this provider has for this enrollee's plan
      const providerBandsForPlan = provider.plan_bands
        .filter(pb => accessibleBands.includes(pb.band_type))
        .map(pb => pb.band_type)

      return {
        id: provider.id,
        provider_id: provider.provider_id,
        facility_name: provider.facility_name,
        facility_type: provider.facility_type,
        address: provider.address,
        phone_whatsapp: provider.phone_whatsapp,
        email: provider.email,
        practice: provider.practice,
        status: provider.status,
        // Band information
        accessible_bands: providerBandsForPlan,
        enrollee_bands: enrolleeBands,
        is_accessible: true, // All providers returned are accessible
        band_match_message: `Provider accessible under band(s): ${providerBandsForPlan.join(", ")}`
      }
    })

    return NextResponse.json({
      success: true,
      enrollee: {
        id: enrollee.id,
        enrollee_id: enrollee.enrollee_id,
        name: `${enrollee.first_name} ${enrollee.last_name}`,
        plan: enrollee.plan.name,
        bands: enrolleeBands
      },
      providers: formattedProviders,
      total_accessible_providers: formattedProviders.length,
      band_summary: {
        enrollee_bands: enrolleeBands,
        accessible_bands: accessibleBands,
        total_bands: accessibleBands.length,
        message: accessibleBands.length > 0
          ? `Enrollee can access providers under ${accessibleBands.length} band(s): ${accessibleBands.join(", ")}`
          : "Enrollee has no accessible bands configured"
      }
    })

  } catch (error) {
    console.error("Error fetching accessible providers:", error)
    return NextResponse.json(
      { error: "Failed to fetch accessible providers" },
      { status: 500 }
    )
  }
}

// POST method for bulk validation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has call-centre permissions
    const hasPermission = await checkPermission(session.user.role as any, "call-centre", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { enrolleeId, providerIds } = await request.json()

    if (!enrolleeId) {
      return NextResponse.json({ error: "Enrollee ID is required" }, { status: 400 })
    }

    // Get enrollee details with plan
    const enrollee = await prisma.principalAccount.findFirst({
      where: { enrollee_id: enrolleeId },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            assigned_bands: true,
            band_type: true
          }
        }
      }
    })

    if (!enrollee || !enrollee.plan) {
      return NextResponse.json({ error: "Enrollee or plan not found" }, { status: 404 })
    }

    // Determine enrollee's band(s)
    const enrolleeBands = enrollee.plan.assigned_bands && enrollee.plan.assigned_bands.length > 0 
      ? enrollee.plan.assigned_bands 
      : (enrollee.plan.band_type ? [enrollee.plan.band_type] : ["Band A"])

    // Check accessibility for specific providers
    const providerAccessibility = await Promise.all(
      (providerIds || []).map(async (providerId: string) => {
        const planBand = await prisma.planBand.findFirst({
          where: {
            plan_id: enrollee.plan!.id,
            provider_id: providerId,
            status: 'ACTIVE',
            band_type: {
              in: enrolleeBands
            }
          },
          include: {
            provider: {
              select: {
                facility_name: true,
                facility_type: true
              }
            }
          }
        })

        return {
          provider_id: providerId,
          is_accessible: !!planBand,
          provider_band: planBand?.band_type || null,
          enrollee_bands: enrolleeBands,
          message: planBand 
            ? `Provider accessible under band: ${planBand.band_type}`
            : `Provider not accessible - no matching bands (${enrolleeBands.join(", ")})`
        }
      })
    )

    return NextResponse.json({
      success: true,
      enrollee: {
        id: enrollee.id,
        enrollee_id: enrollee.enrollee_id,
        name: `${enrollee.first_name} ${enrollee.last_name}`,
        plan: enrollee.plan.name,
        bands: enrolleeBands
      },
      provider_accessibility: providerAccessibility,
      summary: {
        total_checked: providerAccessibility.length,
        accessible: providerAccessibility.filter(p => p.is_accessible).length,
        not_accessible: providerAccessibility.filter(p => !p.is_accessible).length
      }
    })

  } catch (error) {
    console.error("Error validating provider accessibility:", error)
    return NextResponse.json(
      { error: "Failed to validate provider accessibility" },
      { status: 500 }
    )
  }
}
