import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { ApprovalStage, PlanStatus, PlanClassification } from "@prisma/client"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canEdit = await checkPermission(session.user.role as any, "underwriting", "edit")
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const rawId = String(params.id || "").trim()
    const looksLikeInternalId = /^[a-z0-9]{20,}$/i.test(rawId)

    const plan = await prisma.plan.findFirst({
      where: looksLikeInternalId
        ? {
            OR: [{ id: rawId }, { plan_id: rawId }],
          }
        : {
            plan_id: rawId,
          },
      include: {
        plan_limits: true,
        covered_services: true,
        package_limits: true,
      },
    })

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    // Only CUSTOM plans can be submitted to Special Services
    if (plan.classification !== PlanClassification.CUSTOM) {
      return NextResponse.json(
        {
          success: false,
          error: "Only CUSTOM plans can be submitted to Special Services",
        },
        { status: 400 }
      )
    }

    // Only allow submission if status is IN_PROGRESS or DRAFT
    if (plan.status !== PlanStatus.IN_PROGRESS && plan.status !== PlanStatus.DRAFT) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot submit plan. Current status: ${plan.status}`,
        },
        { status: 400 }
      )
    }

    // Update plan to send to Special Services
    const updatedPlan = await prisma.plan.update({
      where: { id: plan.id },
      data: {
        status: PlanStatus.PENDING_APPROVAL,
        approval_stage: ApprovalStage.SPECIAL_RISK,
      },
      include: {
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        plan_limits: true,
        covered_services: true,
        package_limits: true,
      },
    })

    try {
      await prisma.auditLog.create({
        data: {
          user_id: session.user.id,
          action: "PLAN_SUBMIT_TO_SPECIAL_RISK",
          resource: "plan",
          resource_id: updatedPlan.id,
          old_values: {
            status: plan.status,
            approval_stage: plan.approval_stage,
          },
          new_values: {
            status: updatedPlan.status,
            approval_stage: updatedPlan.approval_stage,
          },
        },
      })
    } catch (auditError) {
      console.error("Audit log write failed for PLAN_SUBMIT_TO_SPECIAL_RISK:", auditError)
    }

    return NextResponse.json({
      success: true,
      data: updatedPlan,
    })
  } catch (error) {
    console.error("Error submitting plan to Special Services:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to submit plan",
      },
      { status: 500 }
    )
  }
}

