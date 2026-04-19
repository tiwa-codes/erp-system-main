import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { ApprovalStage, PlanStatus } from "@prisma/client"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canApprove = await checkPermission(session.user.role as any, "executive-desk", "approve")
    if (!canApprove) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const plan = await prisma.plan.findUnique({
      where: { id: params.id },
    })

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    if (plan.approval_stage !== ApprovalStage.MD) {
      return NextResponse.json(
        {
          success: false,
          error: "Plan is not in MD approval stage",
        },
        { status: 400 }
      )
    }

    if (plan.status !== PlanStatus.PENDING_APPROVAL) {
      return NextResponse.json(
        {
          success: false,
          error: `Plan status must be PENDING_APPROVAL. Current status: ${plan.status}`,
        },
        { status: 400 }
      )
    }

    // Final approval - make plan ACTIVE and available for use
    const updatedPlan = await prisma.plan.update({
      where: { id: params.id },
      data: {
        approval_stage: ApprovalStage.COMPLETE,
        status: PlanStatus.ACTIVE,
        md_approved_at: new Date(),
        md_approved_by_id: session.user.id,
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
        special_risk_approved_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        md_approved_by: {
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

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "EXECUTIVE_DESK_PLAN_APPROVE",
        resource: "plan",
        resource_id: updatedPlan.id,
        old_values: {
          approval_stage: plan.approval_stage,
          status: plan.status,
        },
        new_values: {
          approval_stage: updatedPlan.approval_stage,
          status: updatedPlan.status,
          md_approved_at: updatedPlan.md_approved_at,
          md_approved_by_id: updatedPlan.md_approved_by_id,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedPlan,
    })
  } catch (error) {
    console.error("Error approving plan:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to approve plan",
      },
      { status: 500 }
    )
  }
}








