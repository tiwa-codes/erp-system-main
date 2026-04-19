import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

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

    // Check if user has settings permissions
    const hasPermission = await checkPermission(session.user.role as any, "settings", "view")
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

    // Check if user has settings permissions
    const hasPermission = await checkPermission(session.user.role as any, "settings", "edit")
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

    // Check if user has settings permissions
    const hasPermission = await checkPermission(session.user.role as any, "settings", "delete")
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

    // Soft delete by updating status
    const deletedPlan = await prisma.plan.update({
      where: { id: params.id },
      data: { 
        status: 'INACTIVE',
        updated_at: new Date()
      }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "PLAN_DELETE",
        resource: "plan",
        resource_id: params.id,
        old_values: existingPlan,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Plan deleted successfully"
    })

  } catch (error) {
    console.error("Error deleting plan:", error)
    return NextResponse.json(
      { error: "Failed to delete plan" },
      { status: 500 }
    )
  }
}
