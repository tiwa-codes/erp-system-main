import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const packageLimitSchema = z.object({
  plan_id: z.string().min(1, "Plan is required"),
  category: z.string().min(1, "Category is required"),
  service_name: z.string().optional().nullable(),
  amount: z.number().min(0, "Amount must be positive"),
  default_price: z.number().optional().nullable(),
  input_type: z.enum(["NUMBER", "DROPDOWN", "ALPHANUMERIC"]).default("NUMBER"),
  is_customizable: z.boolean().default(true),
  limit_type: z.enum(["PRICE", "FREQUENCY"]).default("PRICE"),
  limit_frequency: z.string().optional().nullable(),
  coverage_status: z.enum(["COVERED", "NOT_COVERED"]).default("COVERED"),
})

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
    const validatedData = packageLimitSchema.parse(body)

    // Check if package limit exists
    const existingLimit = await prisma.packageLimit.findUnique({
      where: { id: params.id }
    })

    if (!existingLimit) {
      return NextResponse.json(
        { error: "Package limit not found" },
        { status: 404 }
      )
    }

    // Check if another package limit with same combination exists
    const duplicateLimit = await prisma.packageLimit.findFirst({
      where: {
        plan_id: validatedData.plan_id,
        category: validatedData.category,
        service_name: validatedData.service_name || null,
        id: { not: params.id }
      }
    })

    if (duplicateLimit) {
      return NextResponse.json(
        { error: "Package limit already exists for this plan and category" },
        { status: 400 }
      )
    }

    const packageLimit = await prisma.packageLimit.update({
      where: { id: params.id },
      data: {
        plan_id: validatedData.plan_id,
        category: validatedData.category,
        service_name: validatedData.service_name || null,
        amount: validatedData.amount,
        default_price: validatedData.default_price || null,
        input_type: validatedData.input_type as any,
        is_customizable: validatedData.is_customizable,
        limit_type: validatedData.limit_type as any,
        limit_frequency: validatedData.limit_frequency || null,
        coverage_status: validatedData.coverage_status as any,
      },
      include: {
        plan: {
          select: {
            name: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      packageLimit
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error updating package limit:", error)
    return NextResponse.json(
      { error: "Failed to update package limit" },
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

    // Check if package limit exists
    const existingLimit = await prisma.packageLimit.findUnique({
      where: { id: params.id }
    })

    if (!existingLimit) {
      return NextResponse.json(
        { error: "Package limit not found" },
        { status: 404 }
      )
    }

    await prisma.packageLimit.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      success: true,
      message: "Package limit deleted successfully"
    })

  } catch (error) {
    console.error("Error deleting package limit:", error)
    return NextResponse.json(
      { error: "Failed to delete package limit" },
      { status: 500 }
    )
  }
}
