import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { checkPermission } from "@/lib/permissions"
import { getCategoryLimitAvailability, withCategoryLimitMetrics } from "@/lib/call-centre/category-limit-metrics"

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const enrolleeId = searchParams.get("enrollee_id")
    const search = searchParams.get("search") || ""

    if (!enrolleeId) {
      return NextResponse.json({ error: "Enrollee ID is required" }, { status: 400 })
    }

    // Resolve enrollee to principal context (supports principal ID, enrollee ID, dependent ID)
    const principal = await prisma.principalAccount.findFirst({
      where: {
        OR: [
          { id: enrolleeId },
          { enrollee_id: enrolleeId }
        ]
      },
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
    let enrolleeContext = principal

    if (!enrolleeContext) {
      const dependent = await prisma.dependent.findFirst({
        where: {
          OR: [
            { id: enrolleeId },
            { dependent_id: enrolleeId }
          ]
        },
        include: {
          principal: {
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
          }
        }
      })

      if (dependent?.principal) {
        enrolleeContext = dependent.principal
      }
    }

    if (!enrolleeContext) {
      return NextResponse.json({ error: "Enrollee not found" }, { status: 404 })
    }

    // Get all service types
    const trimmedSearch = search.trim()
    const whereClause: Prisma.ServiceTypeWhereInput = trimmedSearch ? {
      OR: [
        { service_name: { contains: trimmedSearch, mode: Prisma.QueryMode.insensitive } },
        { service_category: { contains: trimmedSearch, mode: Prisma.QueryMode.insensitive } },
      ]
    } : {}

    const allServices = await prisma.serviceType.findMany({
      where: whereClause,
      orderBy: {
        service_name: 'asc'
      }
    })

    // Get covered services only when a plan exists
    const coveredServices = enrolleeContext.plan?.id
      ? await prisma.coveredService.findMany({
          where: {
            plan_id: enrolleeContext.plan.id
          },
          include: {
            service_type: {
              select: {
                id: true,
                service_name: true,
                service_category: true
              }
            }
          }
        })
      : []

    // Create a map of covered service IDs for quick lookup
    const coveredServiceIds = new Set(coveredServices.map(cs => cs.service_type.id))

    // Get services assigned to any plan (to determine "Not in plan" vs "Not assigned")
    const assignedServices = await prisma.coveredService.findMany({
      select: {
        service_type_id: true
      },
      distinct: ['service_type_id']
    })

    const assignedServiceIds = new Set(assignedServices.map(as => as.service_type_id))

    // Determine enrollee's band(s) for enhanced validation
    const enrolleeBands = enrolleeContext.plan?.assigned_bands && enrolleeContext.plan.assigned_bands.length > 0
      ? enrolleeContext.plan.assigned_bands
      : (enrolleeContext.plan?.band_type ? [enrolleeContext.plan.band_type] : ["Band A"])

    // Combine all services with their coverage status
    const servicesWithCoverageRaw = allServices.map(service => {
      let coverageStatus = "NOT_ASSIGNED"
      let facilityPrice = 0
      let limitCount = 0
      let statusMessage = "Service is not assigned to any plan"

      if (coveredServiceIds.has(service.id)) {
        // Service is covered by this enrollee's plan
        const coveredService = coveredServices.find(cs => cs.service_type.id === service.id)
        coverageStatus = "IN_PLAN"
        facilityPrice = Number(coveredService?.facility_price || 0)
        limitCount = coveredService?.limit_count || 0
        statusMessage = "Service is covered under enrollee's plan"
      } else if (assignedServiceIds.has(service.id)) {
        // Service is assigned to some plan but not this enrollee's plan
        coverageStatus = "NOT_IN_PLAN"
        statusMessage = "Service is not covered under enrollee's plan"
      }

      return {
        id: service.id,
        service_name: service.service_name,
        service_category: service.service_category,
        coverage_status: coverageStatus,
        facility_price: facilityPrice,
        limit_count: limitCount,
        selectable: coverageStatus === "IN_PLAN" && Boolean(enrolleeContext.plan?.id),
        status_message: statusMessage,
        enrollee_bands: enrolleeBands
      }
    })
    const servicesWithCoverageBase = await withCategoryLimitMetrics(
      servicesWithCoverageRaw,
      enrolleeId
    )
    const servicesWithCoverage = servicesWithCoverageBase.map((service) => {
      const availability = getCategoryLimitAvailability(service)

      if (service.coverage_status !== "IN_PLAN") {
        return service
      }

      return {
        ...service,
        coverage_status: availability.isBlocked ? "LIMIT_EXCEEDED" : service.coverage_status,
        selectable: !availability.isBlocked,
        status_message: availability.reason || service.status_message
      }
    })

    return NextResponse.json({
      success: true,
      enrollee: {
        id: enrolleeContext.id,
        enrollee_id: enrolleeContext.enrollee_id,
        name: `${enrolleeContext.first_name} ${enrolleeContext.last_name}`,
        plan: enrolleeContext.plan,
        bands: enrolleeBands
      },
      services: servicesWithCoverage
    })

  } catch (error) {
    console.error("Error fetching services coverage:", error)
    return NextResponse.json(
      { error: "Failed to fetch services coverage" },
      { status: 500 }
    )
  }
}
