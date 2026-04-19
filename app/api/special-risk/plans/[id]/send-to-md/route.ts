import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { ApprovalStage, PlanStatus } from "@prisma/client"

const looksLikeInternalId = (value: string) => /^[a-z0-9]{20,}$/i.test(String(value || "").trim())

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canSend = await checkPermission(session.user.role as any, "special-risk", "approve")
    if (!canSend) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const rawId = String(params.id || "").trim()
    const plan = await prisma.plan.findFirst({
      where: looksLikeInternalId(rawId)
        ? { OR: [{ id: rawId }, { plan_id: rawId }] }
        : { plan_id: rawId },
    })

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    if (plan.approval_stage !== ApprovalStage.SPECIAL_RISK) {
      return NextResponse.json(
        {
          success: false,
          error: "Plan is not in Special Services approval stage",
        },
        { status: 400 }
      )
    }

    if (![PlanStatus.DRAFT, PlanStatus.IN_PROGRESS, PlanStatus.PENDING_APPROVAL].includes(plan.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot send plan to MD from status ${plan.status}`,
        },
        { status: 400 }
      )
    }

    const updatedPlan = await prisma.plan.update({
      where: { id: plan.id },
      data: {
        approval_stage: ApprovalStage.MD,
        status: PlanStatus.PENDING_APPROVAL,
        special_risk_approved_at: new Date(),
        special_risk_approved_by_id: session.user.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "SPECIAL_RISK_PLAN_SEND_TO_MD",
        resource: "plan",
        resource_id: updatedPlan.id,
        old_values: {
          approval_stage: plan.approval_stage,
          status: plan.status,
        },
        new_values: {
          approval_stage: updatedPlan.approval_stage,
          status: updatedPlan.status,
          special_risk_approved_by_id: updatedPlan.special_risk_approved_by_id,
          special_risk_approved_at: updatedPlan.special_risk_approved_at,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedPlan,
    })
  } catch (error) {
    console.error("Error sending plan to MD:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send plan to MD",
      },
      { status: 500 }
    )
  }
}
