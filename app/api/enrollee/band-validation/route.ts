import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { checkPermission } from "@/lib/permissions"

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

    const { enrolleeId, providerId, serviceId } = await request.json()

    if (!enrolleeId) {
      return NextResponse.json({ error: "Enrollee ID is required" }, { status: 400 })
    }

    // Get enrollee details with plan and organization
    const enrollee = await prisma.principalAccount.findFirst({
      where: { enrollee_id: enrolleeId },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            assigned_bands: true,
            band_type: true // Legacy field
          }
        },
        organization: {
          select: {
            id: true,
            name: true,
            code: true
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

    // Determine enrollee's band(s)
    const enrolleeBands = enrollee.plan.assigned_bands && enrollee.plan.assigned_bands.length > 0 
      ? enrollee.plan.assigned_bands 
      : (enrollee.plan.band_type ? [enrollee.plan.band_type] : ["Band A"]) // Default to Band A

    console.log("Enrollee bands:", enrolleeBands)

    // If providerId is provided, check provider band coverage
    let providerBandStatus = null
    if (providerId) {
      const planBand = await prisma.planBand.findFirst({
        where: {
          plan_id: enrollee.plan.id,
          provider_id: providerId,
          status: 'ACTIVE'
        },
        include: {
          provider: {
            select: {
              facility_name: true,
              hcp_code: true
            }
          }
        }
      })

      if (planBand) {
        // Check if the provider's band matches any of the enrollee's bands
        const providerBand = planBand.band_type
        const isBandMatch = enrolleeBands.some(band => 
          band.toLowerCase() === providerBand.toLowerCase()
        )

        providerBandStatus = {
          providerBand,
          enrolleeBands,
          isCovered: isBandMatch,
          status: isBandMatch ? "IN_BAND" : "NOT_IN_BAND",
          message: isBandMatch 
            ? `Provider is covered under enrollee's band(s): ${enrolleeBands.join(", ")}`
            : `Provider band (${providerBand}) does not match enrollee's band(s): ${enrolleeBands.join(", ")}`
        }
      } else {
        providerBandStatus = {
          providerBand: "Unknown",
          enrolleeBands,
          isCovered: false,
          status: "NOT_IN_BAND",
          message: "Provider is not assigned to this enrollee's plan"
        }
      }
    }

    // If serviceId is provided, check service plan coverage
    let servicePlanStatus = null
    if (serviceId) {
      const coveredService = await prisma.coveredService.findFirst({
        where: {
          plan_id: enrollee.plan.id,
          service_type_id: serviceId,
          status: 'ACTIVE'
        },
        include: {
          service_type: {
            select: {
              service_name: true,
              service_category: true
            }
          }
        }
      })

      if (coveredService) {
        servicePlanStatus = {
          serviceName: coveredService.service_type.service_name,
          serviceCategory: coveredService.service_type.service_category,
          isCovered: true,
          status: "IN_PLAN",
          facilityPrice: Number(coveredService.facility_price),
          limitCount: coveredService.limit_count,
          message: `Service is covered under enrollee's plan`
        }
      } else {
        // Check if service is assigned to any plan
        const assignedService = await prisma.coveredService.findFirst({
          where: {
            service_type_id: serviceId
          },
          include: {
            service_type: {
              select: {
                service_name: true,
                service_category: true
              }
            }
          }
        })

        if (assignedService) {
          servicePlanStatus = {
            serviceName: assignedService.service_type.service_name,
            serviceCategory: assignedService.service_type.service_category,
            isCovered: false,
            status: "NOT_IN_PLAN",
            message: `Service is not covered under enrollee's plan`
          }
        } else {
          servicePlanStatus = {
            serviceName: "Unknown Service",
            serviceCategory: "Unknown",
            isCovered: false,
            status: "NOT_ASSIGNED",
            message: `Service is not assigned to any plan`
          }
        }
      }
    }

    // Determine overall eligibility
    let overallStatus = "ELIGIBLE"
    let overallMessage = "Enrollee is eligible for service"
    const issues = []

    if (providerBandStatus && !providerBandStatus.isCovered) {
      overallStatus = "NOT_ELIGIBLE"
      issues.push(providerBandStatus.message)
    }

    if (servicePlanStatus && !servicePlanStatus.isCovered) {
      overallStatus = "NOT_ELIGIBLE"
      issues.push(servicePlanStatus.message)
    }

    if (issues.length > 0) {
      overallMessage = issues.join("; ")
    }

    return NextResponse.json({
      success: true,
      enrollee: {
        id: enrollee.id,
        enrollee_id: enrollee.enrollee_id,
        name: `${enrollee.first_name} ${enrollee.last_name}`,
        plan: enrollee.plan.name,
        bands: enrolleeBands
      },
      providerBandStatus,
      servicePlanStatus,
      overallStatus,
      overallMessage,
      isEligible: overallStatus === "ELIGIBLE"
    })

  } catch (error) {
    console.error("Error validating enrollee band coverage:", error)
    return NextResponse.json(
      { error: "Failed to validate enrollee band coverage" },
      { status: 500 }
    )
  }
}

// GET method for checking multiple services at once
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
    const providerId = searchParams.get("provider_id")
    const search = searchParams.get("search") || ""

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

    if (!enrollee) {
      return NextResponse.json({ error: "Enrollee not found" }, { status: 404 })
    }

    if (!enrollee.plan) {
      return NextResponse.json({ 
        error: "Enrollee has no active plan",
        status: "NO_PLAN"
      }, { status: 400 })
    }

    // Determine enrollee's band(s)
    const enrolleeBands = enrollee.plan.assigned_bands && enrollee.plan.assigned_bands.length > 0 
      ? enrollee.plan.assigned_bands 
      : (enrollee.plan.band_type ? [enrollee.plan.band_type] : ["Band A"])

    // Get all service types
    const whereClause: Prisma.ServiceTypeWhereInput = search ? {
      OR: [
        { service_name: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { service_category: { contains: search, mode: Prisma.QueryMode.insensitive } },
      ]
    } : {}

    const allServices = await prisma.serviceType.findMany({
      where: whereClause,
      orderBy: {
        service_name: 'asc'
      }
    })

    // Get covered services for this enrollee's plan
    const coveredServices = await prisma.coveredService.findMany({
      where: {
        plan_id: enrollee.plan.id,
        status: 'ACTIVE'
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

    // Check provider band coverage if providerId is provided
    let providerBandStatus = null
    if (providerId) {
      const planBand = await prisma.planBand.findFirst({
        where: {
          plan_id: enrollee.plan.id,
          provider_id: providerId,
          status: 'ACTIVE'
        },
        include: {
          provider: {
            select: {
              facility_name: true,
              hcp_code: true
            }
          }
        }
      })

      if (planBand) {
        const providerBand = planBand.band_type
        const isBandMatch = enrolleeBands.some(band => 
          band.toLowerCase() === providerBand.toLowerCase()
        )

        providerBandStatus = {
          providerBand,
          enrolleeBands,
          isCovered: isBandMatch,
          status: isBandMatch ? "IN_BAND" : "NOT_IN_BAND",
          message: isBandMatch 
            ? `Provider is covered under enrollee's band(s): ${enrolleeBands.join(", ")}`
            : `Provider band (${providerBand}) does not match enrollee's band(s): ${enrolleeBands.join(", ")}`
        }
      } else {
        providerBandStatus = {
          providerBand: "Unknown",
          enrolleeBands,
          isCovered: false,
          status: "NOT_IN_BAND",
          message: "Provider is not assigned to this enrollee's plan"
        }
      }
    }

    // Combine all services with their coverage status
    const servicesWithCoverage = allServices.map(service => {
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

      // Determine overall eligibility considering both service and provider coverage
      let overallEligible = coverageStatus === "IN_PLAN"
      let overallStatus = coverageStatus
      let overallMessage = statusMessage

      if (providerBandStatus && !providerBandStatus.isCovered) {
        overallEligible = false
        overallStatus = "NOT_IN_BAND"
        overallMessage = `Service may be in plan but provider band (${providerBandStatus.providerBand}) does not match enrollee's band(s): ${enrolleeBands.join(", ")}`
      }

      return {
        id: service.id,
        service_name: service.service_name,
        service_category: service.service_category,
        coverage_status: coverageStatus,
        overall_status: overallStatus,
        facility_price: facilityPrice,
        limit_count: limitCount,
        selectable: overallEligible,
        status_message: overallMessage
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
      providerBandStatus,
      services: servicesWithCoverage
    })

  } catch (error) {
    console.error("Error fetching services with band validation:", error)
    return NextResponse.json(
      { error: "Failed to fetch services with band validation" },
      { status: 500 }
    )
  }
}
