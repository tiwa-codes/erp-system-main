import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const hasPermission = await checkPermission(session.user.role as any, "provider", "manage_tariff_plan")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params
    if (!id) {
      return NextResponse.json({ error: "Tariff plan ID is required" }, { status: 400 })
    }

    const tariffPlan = await prisma.tariffPlan.findUnique({
      where: { id }
    })

    if (!tariffPlan) {
      return NextResponse.json({ error: "Tariff plan not found" }, { status: 404 })
    }

    if (!tariffPlan.is_customized) {
      await prisma.tariffPlan.update({
        where: { id },
        data: {
          status: "COMPLETE",
          approval_stage: "COMPLETE",
          approved_at: new Date()
        }
      })

      await prisma.tariffPlanService.updateMany({
        where: { tariff_plan_id: id },
        data: {
          is_draft: false,
          status: "ACTIVE"
        }
      })

      await prisma.auditLog.create({
        data: {
          user_id: session.user.id,
          action: "TARIFF_PLAN_COMPLETE_GENERAL",
          resource: "tariff_plan",
          resource_id: id,
          new_values: {
            status: "COMPLETE"
          }
        }
      })

      return NextResponse.json({
        success: true,
        message: "General plan marked as complete"
      })
    }

    return NextResponse.json({ error: "Only general plans can be completed directly" }, { status: 400 })
  } catch (error) {
    console.error("Error completing general tariff plan:", error)
    return NextResponse.json({ error: "Failed to complete plan" }, { status: 500 })
  }
}








