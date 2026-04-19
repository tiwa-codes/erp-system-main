import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { transitionTariffPlanStage } from "@/lib/tariff-plan-workflow"

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
    const body = await request.json().catch(() => ({}))
    const comments =
      typeof body?.comments === "string" && body.comments.trim().length > 0
        ? body.comments.trim()
        : undefined

    if (!id) {
      return NextResponse.json({ error: "Tariff plan ID is required" }, { status: 400 })
    }

    const result = await transitionTariffPlanStage({
      id,
      currentStage: "UNDERWRITING",
      nextStage: "MD"
    })

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status || 400 })
    }

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "TARIFF_PLAN_STAGE_UNDERWRITING_APPROVED",
        resource: "tariff_plan",
        resource_id: id,
        new_values: {
          approval_stage: "MD",
          comments: comments || null,
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: "Tariff plan advanced to MD review",
      tariffPlan: result.tariffPlan
    })
  } catch (error) {
    console.error("Error advancing tariff plan stage:", error)
    return NextResponse.json({ error: "Failed to advance tariff plan stage" }, { status: 500 })
  }
}








