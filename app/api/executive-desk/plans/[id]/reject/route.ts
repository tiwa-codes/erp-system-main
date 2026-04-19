import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { ApprovalStage, PlanStatus } from "@prisma/client"

function mergePlanMetadata(existing: any, patch: Record<string, unknown>) {
  const base = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {}
  return { ...base, ...patch }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canReject = await checkPermission(session.user.role as any, "executive-desk", "approve")
    if (!canReject) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { rejection_reason } = await request.json()

    if (!rejection_reason || !String(rejection_reason).trim()) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 })
    }

    const plan = await prisma.plan.findUnique({
      where: { id: params.id },
    })

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    if (plan.approval_stage !== ApprovalStage.MD) {
      return NextResponse.json(
        { success: false, error: "Plan is not in MD approval stage" },
        { status: 400 }
      )
    }

    const updatedPlan = await prisma.plan.update({
      where: { id: params.id },
      data: {
        approval_stage: ApprovalStage.SPECIAL_RISK,
        status: PlanStatus.PENDING_APPROVAL,
        special_risk_approved_at: null,
        special_risk_approved_by_id: null,
        md_approved_at: null,
        md_approved_by_id: null,
        metadata: mergePlanMetadata(plan.metadata, {
          last_rejection: {
            stage: "MD",
            reason: String(rejection_reason).trim(),
            rejected_at: new Date().toISOString(),
            rejected_by_id: session.user.id,
          },
        }),
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "EXECUTIVE_DESK_PLAN_REJECT",
        resource: "plan",
        resource_id: updatedPlan.id,
        old_values: {
          approval_stage: plan.approval_stage,
          status: plan.status,
          metadata: plan.metadata,
        },
        new_values: {
          approval_stage: updatedPlan.approval_stage,
          status: updatedPlan.status,
          rejection_reason: String(rejection_reason).trim(),
          metadata: updatedPlan.metadata,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedPlan,
    })
  } catch (error) {
    console.error("Error rejecting plan in Executive Desk:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reject plan",
      },
      { status: 500 }
    )
  }
}
