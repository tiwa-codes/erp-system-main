import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { LegalDocumentStatus } from "@prisma/client"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canVet = await checkPermission(session.user.role as any, "legal", "vet")
    if (!canVet) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const meeting = await prisma.meetingMinutes.findUnique({
      where: { id: params.id },
    })

    if (!meeting) {
      return NextResponse.json({ error: "Meeting minutes not found" }, { status: 404 })
    }

    if (meeting.status !== LegalDocumentStatus.DRAFT) {
      return NextResponse.json(
        {
          success: false,
          error: "Only draft meeting minutes can be vetted",
        },
        { status: 400 }
      )
    }

    const updatedMeeting = await prisma.meetingMinutes.update({
      where: { id: params.id },
      data: {
        status: LegalDocumentStatus.VETTED,
        vetted_by_id: session.user.id,
        vetted_at: new Date(),
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
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "MEETING_MINUTES_VET",
        resource: "meeting_minutes",
        resource_id: updatedMeeting.id,
        old_values: {
          status: meeting.status,
        },
        new_values: {
          status: updatedMeeting.status,
          vetted_by_id: updatedMeeting.vetted_by_id,
          vetted_at: updatedMeeting.vetted_at,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedMeeting,
    })
  } catch (error) {
    console.error("Error vetting meeting minutes:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to vet meeting minutes",
      },
      { status: 500 }
    )
  }
}

