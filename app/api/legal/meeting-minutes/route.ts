import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"
import { MeetingType, LegalDocumentStatus } from "@prisma/client"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

const meetingMinutesCreateSchema = z.object({
  meeting_type: z.nativeEnum(MeetingType),
  meeting_date: z.string().datetime(),
  title: z.string().min(1, "Title is required"),
  attendees: z.array(z.object({
    name: z.string(),
    email: z.string().email().optional().or(z.literal("")),
  })).optional().default([]),
  meeting_notes: z.string().min(1, "Meeting notes are required"),
  attachments: z.array(z.string().url()).optional().default([]),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "legal", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim()
    const meetingType = searchParams.get("meeting_type") as MeetingType | null
    const status = searchParams.get("status") as LegalDocumentStatus | null
    const page = parseInt(searchParams.get("page") || "1")
    const limit = Math.min(parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT)), MAX_LIMIT)
    const skip = (page - 1) * limit

    const where: any = {}

    // Sales team can only see approved meeting minutes
    const userRole = session.user.role as any
    if (userRole === "SALES" || (typeof userRole === "object" && userRole?.name === "SALES")) {
      where.status = LegalDocumentStatus.APPROVED
    } else {
      if (status) {
        where.status = status
      }
    }

    if (meetingType) {
      where.meeting_type = meetingType
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { meeting_id: { contains: search, mode: "insensitive" } },
        { meeting_notes: { contains: search, mode: "insensitive" } },
      ]
    }

    const [meetings, total] = await Promise.all([
      prisma.meetingMinutes.findMany({
        where,
        skip,
        take: limit,
        orderBy: { meeting_date: "desc" },
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
      }),
      prisma.meetingMinutes.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        meetings,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canAdd = await checkPermission(session.user.role as any, "legal", "add")
    if (!canAdd) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = meetingMinutesCreateSchema.parse(body)

    // Generate unique meeting_id
    const lastMeeting = await prisma.meetingMinutes.findFirst({
      orderBy: { meeting_id: "desc" },
    })

    const nextMeetingId = lastMeeting
      ? (parseInt(lastMeeting.meeting_id) + 1).toString()
      : "1"

    const meeting = await prisma.meetingMinutes.create({
      data: {
        meeting_id: nextMeetingId,
        meeting_type: validatedData.meeting_type,
        meeting_date: new Date(validatedData.meeting_date),
        title: validatedData.title,
        attendees: validatedData.attendees,
        meeting_notes: validatedData.meeting_notes,
        attachments: validatedData.attachments || [],
        status: LegalDocumentStatus.DRAFT,
        created_by_id: session.user.id,
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
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "MEETING_MINUTES_CREATE",
        resource: "meeting_minutes",
        resource_id: meeting.id,
        new_values: {
          meeting_id: meeting.meeting_id,
          meeting_type: meeting.meeting_type,
          title: meeting.title,
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: meeting,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating meeting minutes:", error)
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
        error: error instanceof Error ? error.message : "Failed to create meeting minutes",
      },
      { status: 500 }
    )
  }
}

