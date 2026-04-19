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

    // Check if user has audit permissions
    const hasPermission = await checkPermission(session.user.role as any, "claims", "audit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const provider = searchParams.get("provider") || ""
    const skip = (page - 1) * limit

    // Build where clause for audit vetting (claims that have completed vetter2)
    const where: any = {
      status: {
        in: ['VETTER2_COMPLETED', 'AUDIT_COMPLETED', 'APPROVED', 'REJECTED']
      }
    }

    if (search) {
      where.OR = [
        { claim_number: { contains: search, mode: 'insensitive' } },
        { principal: { 
          OR: [
            { first_name: { contains: search, mode: 'insensitive' } },
            { last_name: { contains: search, mode: 'insensitive' } },
            { enrollee_id: { contains: search, mode: 'insensitive' } }
          ]
        }},
        { provider: { facility_name: { contains: search, mode: 'insensitive' } } }
      ]
    }

    if (status && status !== "all") {
      where.status = status
    }

    if (provider && provider !== "all") {
      where.provider_id = provider
    }

    const [claims, totalCount] = await Promise.all([
      prisma.claim.findMany({
        where,
        include: {
          principal: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              enrollee_id: true
            }
          },
          provider: {
            select: {
              id: true,
              facility_name: true,
              facility_type: true
            }
          }
        },
        orderBy: { submitted_at: 'desc' },
        skip,
        take: limit
      }),
      prisma.claim.count({ where })
    ])

    // Fetch services for each claim from ProviderRequest
    const claimsWithServices = await Promise.all(
      claims.map(async (claim) => {
        // Find the most recent ProviderRequest for this enrollee and provider
        const providerRequest = await prisma.providerRequest.findFirst({
          where: {
            enrollee_id: claim.enrollee_id,
            provider_id: claim.provider_id
          },
          orderBy: { created_at: 'desc' },
          select: {
            services: true,
            diagnosis: true,
            hospital: true
          }
        })

        return {
          ...claim,
          services: providerRequest?.services || claim.claim_type,
          diagnosis: providerRequest?.diagnosis || null,
          hospital: providerRequest?.hospital || claim.provider.facility_name
        }
      })
    )

    return NextResponse.json({
      success: true,
      claims: claimsWithServices,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    })

  } catch (error) {
    console.error("Error fetching operation desk vetting claims:", error)
    return NextResponse.json(
      { error: "Failed to fetch claims" },
      { status: 500 }
    )
  }
}
