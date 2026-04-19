import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { SignatureType } from "@prisma/client"
import { z } from "zod"

const signatureSchema = z.object({
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

    const body = await request.json()
    const validatedData = signatureSchema.parse(body)

    const signature = await prisma.documentSignature.create({
      data: {
        meeting_minutes_id: meeting.id,
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
        action: "MEETING_MINUTES_SIGNATURE",
        resource: "meeting_minutes",
        resource_id: meeting.id,
        new_values: {
          signature_id: signature.id,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: signature,
    })
  } catch (error) {
    console.error("Error creating signature:", error)
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
        error: error instanceof Error ? error.message : "Failed to create signature",
      },
      { status: 500 }
    )
  }
}

