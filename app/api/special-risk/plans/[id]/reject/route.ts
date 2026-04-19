import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { ApprovalStage, PlanStatus } from "@prisma/client"

const looksLikeInternalId = (value: string) => /^[a-z0-9]{20,}$/i.test(String(value || "").trim())

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

    const canReject = await checkPermission(session.user.role as any, "special-risk", "approve")
    if (!canReject) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { rejection_reason } = await request.json()

    if (!rejection_reason || !String(rejection_reason).trim()) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 })
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
        { success: false, error: "Plan is not in Special Services approval stage" },
        { status: 400 }
      )
    }

    const updatedPlan = await prisma.plan.update({
      where: { id: plan.id },
      data: {
        approval_stage: ApprovalStage.UNDERWRITING,
        status: PlanStatus.IN_PROGRESS,
        special_risk_approved_at: null,
        special_risk_approved_by_id: null,
        md_approved_at: null,
        md_approved_by_id: null,
        metadata: mergePlanMetadata(plan.metadata, {
          last_rejection: {
            stage: "SPECIAL_RISK",
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
        action: "SPECIAL_RISK_PLAN_REJECT",
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
    console.error("Error rejecting plan in Special Services:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reject plan",
      },
      { status: 500 }
    )
  }
}
