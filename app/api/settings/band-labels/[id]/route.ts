import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const bandLabelUpdateSchema = z.object({
  label: z.string().min(1, "Label is required").max(50, "Label must be less than 50 characters"),
  description: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE")
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission
    const hasPermission = await checkPermission(session.user.role as any, "settings", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params

    const bandLabel = await prisma.bandLabel.findUnique({
      where: { id }
    })

    if (!bandLabel) {
      return NextResponse.json(
        { error: "Band label not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      band_label: bandLabel
    })
  } catch (error) {
    console.error("Error fetching band label:", error)
    return NextResponse.json(
      { error: "Failed to fetch band label" },
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
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission
    const hasPermission = await checkPermission(session.user.role as any, "settings", "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const validatedData = bandLabelUpdateSchema.parse(body)

    // Check if band label exists
    const existingBandLabel = await prisma.bandLabel.findUnique({
      where: { id }
    })

    if (!existingBandLabel) {
      return NextResponse.json(
        { error: "Band label not found" },
        { status: 404 }
      )
    }

    // Check if label already exists (excluding current record)
    const duplicateBandLabel = await prisma.bandLabel.findFirst({
      where: {
        label: validatedData.label,
        id: { not: id }
      }
    })

    if (duplicateBandLabel) {
      return NextResponse.json(
        { error: "Band label with this name already exists" },
        { status: 400 }
      )
    }

    // Update band label
    const bandLabel = await prisma.bandLabel.update({
      where: { id },
      data: {
        label: validatedData.label,
        description: validatedData.description || null,
        status: validatedData.status
      }
    })

    return NextResponse.json({
      success: true,
      band_label: bandLabel
    })
  } catch (error) {
    console.error("Error updating band label:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to update band label" },
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
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission
    const hasPermission = await checkPermission(session.user.role as any, "settings", "delete")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params

    // Check if band label exists
    const existingBandLabel = await prisma.bandLabel.findUnique({
      where: { id }
    })

    if (!existingBandLabel) {
      return NextResponse.json(
        { error: "Band label not found" },
        { status: 404 }
      )
    }

    // Check if band label is being used in plan bands or plans
    const [planBandCount, planCount] = await Promise.all([
      prisma.planBand.count({
        where: { band_type: existingBandLabel.label }
      }),
      prisma.plan.count({
        where: { band_type: existingBandLabel.label }
      })
    ])

    if (planBandCount > 0 || planCount > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete band label. It is being used in ${planBandCount + planCount} plan(s)` 
        },
        { status: 400 }
      )
    }

    // Delete band label
    await prisma.bandLabel.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: "Band label deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting band label:", error)
    return NextResponse.json(
      { error: "Failed to delete band label" },
      { status: 500 }
    )
  }
}
