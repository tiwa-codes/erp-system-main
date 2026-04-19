import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { buildPlanCustomizationReview } from "@/lib/plan-customization-review"
import { ApprovalStage, PlanStatus } from "@prisma/client"
import { z } from "zod"

const planUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  premium_amount: z.number().positive().optional(),
  annual_limit: z.number().positive().optional(),
  metadata: z.any().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "executive-desk", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const plan = await prisma.plan.findUnique({
      where: { id: params.id },
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
        plan_limits: {
          include: {
            plan: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        covered_services: {
          where: { status: "ACTIVE" },
          include: {
            service_type: {
              select: {
                service_name: true,
                service_category: true,
              },
            },
          },
        },
        package_limits: true,
        plan_coverages: true,
        coverage_rules: true,
      },
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

    const customizations = await buildPlanCustomizationReview(plan)

    return NextResponse.json({
      success: true,
      data: {
        ...plan,
        customizations,
      },
    })
  } catch (error) {
    console.error("Error fetching plan:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch plan",
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canEdit = await checkPermission(session.user.role as any, "executive-desk", "edit")
    if (!canEdit) {
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

    const body = await request.json()
    const validatedData = planUpdateSchema.parse(body)

    const updateData: any = {}
    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.premium_amount !== undefined) updateData.premium_amount = validatedData.premium_amount
    if (validatedData.annual_limit !== undefined) updateData.annual_limit = validatedData.annual_limit
    if (validatedData.metadata !== undefined) updateData.metadata = validatedData.metadata

    const updatedPlan = await prisma.plan.update({
      where: { id: params.id },
      data: updateData,
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
        plan_limits: true,
        covered_services: true,
        package_limits: true,
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "EXECUTIVE_DESK_PLAN_UPDATE",
        resource: "plan",
        resource_id: updatedPlan.id,
        old_values: plan,
        new_values: updatedPlan,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedPlan,
    })
  } catch (error) {
    console.error("Error updating plan:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update plan",
      },
      { status: 500 }
    )
  }
}







