import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

async function canViewCoveredServices(role: string, planId?: string | null) {
  if (await checkPermission(role as any, "settings", "view")) {
    return true
  }

  if (!planId) {
    return false
  }

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: { approval_stage: true },
  })

  if (!plan) {
    return false
  }

  if (plan.approval_stage === "SPECIAL_RISK") {
    return checkPermission(role as any, "special-risk", "view")
  }

  if (plan.approval_stage === "MD") {
    return checkPermission(role as any, "executive-desk", "view")
  }

  return false
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const planId = searchParams.get("plan_id")
    const facilityId = searchParams.get("facility_id")
    const serviceTypeId = searchParams.get("service_type_id")
    const status = searchParams.get("status") || "ACTIVE"

    const hasPermission = await canViewCoveredServices(session.user.role as string, planId)
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const where: any = {}
    
    if (planId) where.plan_id = planId
    if (facilityId) where.facility_id = facilityId
    if (serviceTypeId) where.service_type_id = serviceTypeId
    if (status) where.status = status

    const coveredServices = await prisma.coveredService.findMany({
      where,
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            plan_type: true
          }
        },
        facility: {
          select: {
            id: true,
            facility_name: true,
            practice: true,
            status: true
          }
        },
        service_type: {
          select: {
            id: true,
            service_id: true,
            service_name: true,
            service_category: true,
            service_type: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      covered_services: coveredServices
    })

  } catch (error) {
    console.error("Error fetching covered services:", error)
    return NextResponse.json(
      { error: "Failed to fetch covered services" },
      { status: 500 }
    )
  }
}
