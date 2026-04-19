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

    // Check if user has call-centre permissions
    const hasPermission = await checkPermission(session.user.role as any, "call-centre", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const enrolleeId = searchParams.get("enrollee_id")
    const hospitalId = searchParams.get("hospital_id")
    const search = searchParams.get("search") || ""

    if (!enrolleeId || !hospitalId) {
      return NextResponse.json({ 
        error: "Enrollee ID and Hospital ID are required" 
      }, { status: 400 })
    }

    // Get enrollee with plan details
    const enrollee = await prisma.principalAccount.findUnique({
      where: { id: enrolleeId },
      include: {
        plan: {
          include: {
            covered_services: {
              where: {
                facility_id: hospitalId,
                status: "ACTIVE"
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
            }
          }
        }
      }
    })

    if (!enrollee) {
      return NextResponse.json({ error: "Enrollee not found" }, { status: 404 })
    }

    if (!enrollee.plan) {
      return NextResponse.json({ 
        error: "Enrollee has no active plan" 
      }, { status: 400 })
    }

    // Filter services based on search term
    let eligibleServices = enrollee.plan.covered_services
    if (search) {
      eligibleServices = eligibleServices.filter(service =>
        service.service_type.service_name.toLowerCase().includes(search.toLowerCase()) ||
        service.service_type.service_category.toLowerCase().includes(search.toLowerCase())
      )
    }

    // Format the response
    const formattedServices = eligibleServices.map(service => ({
      id: service.service_type.id,
      service_name: service.service_type.service_name,
      service_category: service.service_type.service_category,
      amount: Number(service.facility_price),
      limit_count: service.limit_count,
      coverage_percentage: 100, // Default to 100% for covered services
      covered: true
    }))

    return NextResponse.json({
      success: true,
      services: formattedServices,
      enrollee: {
        id: enrollee.id,
        enrollee_id: enrollee.enrollee_id,
        first_name: enrollee.first_name,
        last_name: enrollee.last_name,
        plan: {
          id: enrollee.plan.id,
          name: enrollee.plan.name,
          annual_limit: Number(enrollee.plan.annual_limit)
        }
      },
      total: formattedServices.length
    })

  } catch (error) {
    console.error("Error fetching eligible services:", error)
    return NextResponse.json(
      { error: "Failed to fetch eligible services" },
      { status: 500 }
    )
  }
}
