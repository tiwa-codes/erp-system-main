import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const planBandSchema = z.object({
  plan_id: z.string().min(1, "Plan is required"),
  provider_id: z.string().min(1, "Provider is required"),
  band_type: z.string().min(1, "Band type is required"),
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
    const validatedData = planBandSchema.parse(body)

    // Check if plan band exists
    const existingBand = await prisma.planBand.findUnique({
      where: { id: params.id }
    })

    if (!existingBand) {
      return NextResponse.json(
        { error: "Provider plan not found" },
        { status: 404 }
      )
    }

    // Check if another plan band with same combination exists
    const duplicateBand = await prisma.planBand.findFirst({
      where: {
        plan_id: validatedData.plan_id,
        provider_id: validatedData.provider_id,
        id: { not: params.id }
      }
    })

    if (duplicateBand) {
      return NextResponse.json(
        { error: "Provider is already assigned to this plan" },
        { status: 400 }
      )
    }

    const planBand = await prisma.planBand.update({
      where: { id: params.id },
      data: {
        plan_id: validatedData.plan_id,
        provider_id: validatedData.provider_id,
        band_type: validatedData.band_type,
      },
      include: {
        plan: {
          select: {
            name: true
          }
        },
        provider: {
          select: {
            facility_name: true,
            hcp_code: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      planBand
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error updating provider plan:", error)
    return NextResponse.json(
      { error: "Failed to update provider plan" },
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

    // Check if plan band exists
    const existingBand = await prisma.planBand.findUnique({
      where: { id: params.id }
    })

    if (!existingBand) {
      return NextResponse.json(
        { error: "Provider plan not found" },
        { status: 404 }
      )
    }

    await prisma.planBand.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      success: true,
      message: "Provider plan deleted successfully"
    })

  } catch (error) {
    console.error("Error deleting provider plan:", error)
    return NextResponse.json(
      { error: "Failed to delete provider plan" },
      { status: 500 }
    )
  }
}
