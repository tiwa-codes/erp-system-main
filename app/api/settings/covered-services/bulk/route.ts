import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"

const bulkServiceSchema = z.object({
  services: z.array(z.object({
    plan_id: z.string().min(1, "Plan ID is required"),
    facility_id: z.string().min(1, "Facility ID is required"),
    service_type_id: z.string().min(1, "Service Type ID is required"),
    facility_price: z.number().min(0, "Facility price must be non-negative"),
    limit_count: z.number().int().min(1, "Limit count must be at least 1")
  })).min(1, "At least one service is required")
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user role for permission check
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check permissions
    const hasPermission = await checkPermission(user.role, "settings", "add")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = bulkServiceSchema.parse(body)

    const { services } = validatedData

    // Validate that plan, facility, and service types exist
    const planIds = [...new Set(services.map(s => s.plan_id))]
    const facilityIds = [...new Set(services.map(s => s.facility_id))]
    const serviceTypeIds = [...new Set(services.map(s => s.service_type_id))]

    const [plans, facilities, serviceTypes] = await Promise.all([
      prisma.plan.findMany({ where: { id: { in: planIds } } }),
      prisma.provider.findMany({ where: { id: { in: facilityIds } } }),
      prisma.serviceType.findMany({ where: { id: { in: serviceTypeIds } } })
    ])

    if (plans.length !== planIds.length) {
      return NextResponse.json({ error: "One or more plans not found" }, { status: 400 })
    }

    if (facilities.length !== facilityIds.length) {
      return NextResponse.json({ error: "One or more facilities not found" }, { status: 400 })
    }

    if (serviceTypes.length !== serviceTypeIds.length) {
      return NextResponse.json({ error: "One or more service types not found" }, { status: 400 })
    }

    // Check for existing covered services to avoid duplicates
    const existingServices = await prisma.coveredService.findMany({
      where: {
        OR: services.map(service => ({
          plan_id: service.plan_id,
          facility_id: service.facility_id,
          service_type_id: service.service_type_id
        }))
      }
    })

    if (existingServices.length > 0) {
      return NextResponse.json({ 
        error: "Some services already exist for this plan and facility combination",
        existingServices: existingServices.map(s => ({
          plan_id: s.plan_id,
          facility_id: s.facility_id,
          service_type_id: s.service_type_id
        }))
      }, { status: 400 })
    }

    // Create all covered services in a transaction
    const createdServices = await prisma.$transaction(
      services.map(service => 
        prisma.coveredService.create({
          data: {
            plan_id: service.plan_id,
            facility_id: service.facility_id,
            service_type_id: service.service_type_id,
            facility_price: service.facility_price,
            limit_count: service.limit_count,
            status: "ACTIVE"
          },
          include: {
            plan: { select: { name: true } },
            facility: { select: { facility_name: true, hcp_code: true } },
            service_type: { select: { service_name: true, service_category: true } }
          }
        })
      )
    )


    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdServices.length} covered services`,
      data: createdServices
    })

  } catch (error) {
    console.error("Error creating bulk covered services:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      error: "Failed to create covered services",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}