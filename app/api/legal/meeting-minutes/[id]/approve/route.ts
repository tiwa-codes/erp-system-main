import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { LegalDocumentStatus, SignatureType } from "@prisma/client"
import { z } from "zod"

const approveSchema = z.object({
  signature_image_url: z.string().url("Valid signature image URL is required"),
  signature_data: z.any().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canApprove = await checkPermission(session.user.role as any, "legal", "approve")
    if (!canApprove) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const meeting = await prisma.meetingMinutes.findUnique({
      where: { id: params.id },
    })

    if (!meeting) {
      return NextResponse.json({ error: "Meeting minutes not found" }, { status: 404 })
    }

    if (meeting.status !== LegalDocumentStatus.VETTED) {
      return NextResponse.json(
        {
          success: false,
          error: "Only vetted meeting minutes can be approved",
        },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = approveSchema.parse(body)

    // Update meeting status
    const updatedMeeting = await prisma.meetingMinutes.update({
      where: { id: params.id },
      data: {
        status: LegalDocumentStatus.APPROVED,
        approved_by_id: session.user.id,
        approved_at: new Date(),
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
        vetted_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        approved_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    })

    // Create signature record
    const signature = await prisma.documentSignature.create({
      data: {
        meeting_minutes_id: updatedMeeting.id,
        signature_type: SignatureType.MEETING_MINUTES,
        signer_id: session.user.id,
        signature_data: validatedData.signature_data || null,
        signature_image_url: validatedData.signature_image_url,
        ip_address: request.ip || null,
        user_agent: request.headers.get("user-agent") || null,
      },
      include: {
        signer: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "MEETING_MINUTES_APPROVE",
        resource: "meeting_minutes",
        resource_id: updatedMeeting.id,
        old_values: {
          status: meeting.status,
        },
        new_values: {
          status: updatedMeeting.status,
          approved_by_id: updatedMeeting.approved_by_id,
          approved_at: updatedMeeting.approved_at,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...updatedMeeting,
        signature,
      },
    })
  } catch (error) {
    console.error("Error approving meeting minutes:", error)
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
        error: error instanceof Error ? error.message : "Failed to approve meeting minutes",
      },
      { status: 500 }
    )
  }
}

