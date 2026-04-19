import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"
import { Prisma } from "@prisma/client"

async function canAccessPlanByStage(role: string, planId: string, action: "view" | "edit") {
  if (await checkPermission(role as any, "underwriting", action)) {
    return true
  }

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: { approval_stage: true },
  })

  if (!plan) {
    return false
  }

  if (plan.approval_stage === "SPECIAL_RISK") {
    return checkPermission(role as any, "special-risk", action)
  }

  if (plan.approval_stage === "MD") {
    return checkPermission(role as any, "executive-desk", action)
  }

  return false
}

const planClassificationEnum = z.enum(["GENERAL", "CUSTOM"])
const planStatusEnum = z.enum([
  "DRAFT",
  "IN_PROGRESS",
  "PENDING_APPROVAL",
  "COMPLETE",
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
])

const planUpdateSchema = z.object({
  name: z.string().min(1, "Plan name is required").optional(),
  description: z.string().optional(),
  plan_type: z.enum(["INDIVIDUAL", "FAMILY", "CORPORATE"]).optional(),
  premium_amount: z.number().min(0, "Premium amount must be positive").optional(),
  annual_limit: z.number().min(0, "Annual limit must be positive").optional(),
  band_type: z.string().optional(),
  assigned_bands: z.array(z.string()).optional(),
  status: planStatusEnum.optional(),
  classification: planClassificationEnum.optional(),
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

    // Check if user has underwriting permissions
    const hasPermission = await canAccessPlanByStage(session.user.role as string, params.id, "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const plan = await prisma.plan.findUnique({
      where: { id: params.id },
      include: {
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        },
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      plan
    })

  } catch (error) {
    console.error("Error fetching plan:", error)
    return NextResponse.json(
      { error: "Failed to fetch plan" },
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

    // Check if user has underwriting permissions
    const hasPermission = await canAccessPlanByStage(session.user.role as string, params.id, "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    console.log('Plan update request body:', body)
    const validatedData = planUpdateSchema.parse(body)
    console.log('Validated plan update data:', validatedData)

    // Check if plan exists
    const existingPlan = await prisma.plan.findUnique({
      where: { id: params.id }
    })

    if (!existingPlan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    // Update plan
    const updatedPlan = await prisma.plan.update({
      where: { id: params.id },
      data: {
        ...validatedData,
        updated_at: new Date()
      },
      include: {
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        },
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "PLAN_UPDATE",
        resource: "plan",
        resource_id: params.id,
        old_values: existingPlan,
        new_values: updatedPlan,
      },
    })

    console.log('Updated plan returned:', updatedPlan)
    return NextResponse.json({
      success: true,
      plan: updatedPlan
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error updating plan:", error)
    return NextResponse.json(
      { error: "Failed to update plan" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has underwriting permissions
    const hasPermission = await checkPermission(session.user.role as any, "underwriting", "delete")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Check if plan exists
    const existingPlan = await prisma.plan.findUnique({
      where: { id: params.id }
    })

    if (!existingPlan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    // Block deletion only when the plan has real downstream business usage.
    // Pure configuration rows owned by the plan are cleaned up below.
    const [principalsCount, registrationsCount, invoicesCount] = await Promise.all([
      prisma.principalAccount.count({
        where: { plan_id: params.id }
      }),
      prisma.principalRegistration.count({
        where: { plan_id: params.id }
      }),
      prisma.invoice.count({
        where: { plan_id: params.id }
      }),
    ])

    if (principalsCount > 0) {
      return NextResponse.json(
        { 
          error: "Cannot delete plan", 
          message: `This plan is currently assigned to ${principalsCount} enrollee(s). Please reassign them before deleting the plan.`
        },
        { status: 400 }
      )
    }

    if (registrationsCount > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete plan",
          message: `This plan has ${registrationsCount} registration record(s) linked to it. Remove or reassign those registrations before deleting the plan.`,
        },
        { status: 400 }
      )
    }

    if (invoicesCount > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete plan",
          message: `This plan has ${invoicesCount} invoice record(s) linked to it. Remove or reassign those invoices before deleting the plan.`,
        },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      // Log audit trail BEFORE deleting
      await tx.auditLog.create({
        data: {
          user_id: session.user.id,
          action: "PLAN_DELETE",
          resource: "plan",
          resource_id: params.id,
          old_values: existingPlan,
        },
      })

      // Remove plan-owned configuration rows so standalone plans can be deleted cleanly.
      await Promise.all([
        tx.coveredService.deleteMany({ where: { plan_id: params.id } }),
        tx.planCoverage.deleteMany({ where: { plan_id: params.id } }),
        tx.planLimit.deleteMany({ where: { plan_id: params.id } }),
        tx.coverageRule.deleteMany({ where: { plan_id: params.id } }),
        tx.planProvider.deleteMany({ where: { plan_id: params.id } }),
        tx.packageLimit.deleteMany({ where: { plan_id: params.id } }),
        tx.planBand.deleteMany({ where: { plan_id: params.id } }),
        tx.organizationPlan.deleteMany({ where: { plan_id: params.id } }),
      ])

      // Hard delete: Actually remove the record from database
      await tx.plan.delete({
        where: { id: params.id }
      })
    })

    return NextResponse.json({
      success: true,
      message: "Plan deleted successfully"
    })

  } catch (error) {
    console.error("Error deleting plan:", error)

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        {
          error: "Cannot delete plan",
          message: "This plan still has linked records that must be removed or reassigned before deletion.",
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: "Failed to delete plan",
        message: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 }
    )
  }
}
