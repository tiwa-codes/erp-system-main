import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const riskProfileSchema = z.object({
  provider_id: z.string().min(1, "Provider is required"),
  risk_score: z.number().min(0).max(100, "Risk score must be between 0 and 100"),
  risk_level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  assessment_date: z.string().min(1, "Assessment date is required"),
  notes: z.string().optional(),
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
    const validatedData = riskProfileSchema.parse(body)

    // Check if risk profile exists
    const existingProfile = await prisma.riskProfile.findUnique({
      where: { id: params.id }
    })

    if (!existingProfile) {
      return NextResponse.json(
        { error: "Risk profile not found" },
        { status: 404 }
      )
    }

    const riskProfile = await prisma.riskProfile.update({
      where: { id: params.id },
      data: {
        provider_id: validatedData.provider_id,
        risk_score: validatedData.risk_score,
        risk_level: validatedData.risk_level,
        assessment_date: new Date(validatedData.assessment_date),
        last_reviewed: new Date(),
        notes: validatedData.notes,
      },
      include: {
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
      riskProfile
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error updating risk profile:", error)
    return NextResponse.json(
      { error: "Failed to update risk profile" },
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

    // Check if risk profile exists
    const existingProfile = await prisma.riskProfile.findUnique({
      where: { id: params.id }
    })

    if (!existingProfile) {
      return NextResponse.json(
        { error: "Risk profile not found" },
        { status: 404 }
      )
    }

    await prisma.riskProfile.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      success: true,
      message: "Risk profile deleted successfully"
    })

  } catch (error) {
    console.error("Error deleting risk profile:", error)
    return NextResponse.json(
      { error: "Failed to delete risk profile" },
      { status: 500 }
    )
  }
}
