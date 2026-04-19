import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"
import { LegalDocumentStatus, MeetingType } from "@prisma/client"

const meetingMinutesUpdateSchema = z.object({
  meeting_type: z.nativeEnum(MeetingType).optional(),
  meeting_date: z.string().datetime().optional(),
  title: z.string().min(1).optional(),
  attendees: z.array(z.object({
    name: z.string(),
    email: z.string().email().optional(),
  })).optional(),
  meeting_notes: z.string().optional(),
  attachments: z.array(z.string().url()).optional(),
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

    const canView = await checkPermission(session.user.role as any, "legal", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const meeting = await prisma.meetingMinutes.findUnique({
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
        signatures: {
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
          orderBy: { signed_at: "desc" },
        },
      },
    })

    if (!meeting) {
      return NextResponse.json({ error: "Meeting minutes not found" }, { status: 404 })
    }

    // Sales team can only view approved meeting minutes
    const userRole = session.user.role as any
    const isSales = userRole === "SALES" || (typeof userRole === "object" && userRole?.name === "SALES")
    if (isSales && meeting.status !== LegalDocumentStatus.APPROVED) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      data: meeting,
    })
  } catch (error) {
    console.error("Error fetching meeting minutes:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch meeting minutes",
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

    const canEdit = await checkPermission(session.user.role as any, "legal", "edit")
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const meeting = await prisma.meetingMinutes.findUnique({
      where: { id: params.id },
    })

    if (!meeting) {
      return NextResponse.json({ error: "Meeting minutes not found" }, { status: 404 })
    }

    // Only DRAFT meeting minutes can be edited
    if (meeting.status !== LegalDocumentStatus.DRAFT) {
      return NextResponse.json(
        {
          success: false,
          error: "Only draft meeting minutes can be edited",
        },
        { status: 400 }
      )
    }

    // Only creator or users with edit permission can edit
    if (meeting.created_by_id !== session.user.id) {
      const hasEditPermission = await checkPermission(session.user.role as any, "legal", "edit")
      if (!hasEditPermission) {
        return NextResponse.json(
          {
            success: false,
            error: "You can only edit your own meeting minutes",
          },
          { status: 403 }
        )
      }
    }

    const body = await request.json()
    const validatedData = meetingMinutesUpdateSchema.parse(body)

    const updateData: any = {}
    if (validatedData.meeting_type !== undefined) updateData.meeting_type = validatedData.meeting_type
    if (validatedData.meeting_date !== undefined) updateData.meeting_date = new Date(validatedData.meeting_date)
    if (validatedData.title !== undefined) updateData.title = validatedData.title
    if (validatedData.attendees !== undefined) updateData.attendees = validatedData.attendees
    if (validatedData.meeting_notes !== undefined) updateData.meeting_notes = validatedData.meeting_notes
    if (validatedData.attachments !== undefined) updateData.attachments = validatedData.attachments

    const updatedMeeting = await prisma.meetingMinutes.update({
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
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "MEETING_MINUTES_UPDATE",
        resource: "meeting_minutes",
        resource_id: updatedMeeting.id,
        old_values: meeting,
        new_values: updatedMeeting,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedMeeting,
    })
  } catch (error) {
    console.error("Error updating meeting minutes:", error)
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
        error: error instanceof Error ? error.message : "Failed to update meeting minutes",
      },
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

    const canDelete = await checkPermission(session.user.role as any, "legal", "delete")
    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const meeting = await prisma.meetingMinutes.findUnique({
      where: { id: params.id },
    })

    if (!meeting) {
      return NextResponse.json({ error: "Meeting minutes not found" }, { status: 404 })
    }

    // Only DRAFT meeting minutes can be deleted
    if (meeting.status !== LegalDocumentStatus.DRAFT) {
      return NextResponse.json(
        {
          success: false,
          error: "Only draft meeting minutes can be deleted",
        },
        { status: 400 }
      )
    }

    await prisma.meetingMinutes.delete({
      where: { id: params.id },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "MEETING_MINUTES_DELETE",
        resource: "meeting_minutes",
        resource_id: meeting.id,
        old_values: meeting,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Meeting minutes deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting meeting minutes:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete meeting minutes",
      },
      { status: 500 }
    )
  }
}

