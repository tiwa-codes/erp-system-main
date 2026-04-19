import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const uploadDocumentSchema = z.object({
  document_url: z.string().url("Valid document URL is required"),
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

    const canEdit = await checkPermission(session.user.role as any, "finance", "edit")
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const entry = await prisma.journalEntry.findUnique({
      where: { id: params.id },
    })

    if (!entry) {
      return NextResponse.json({ error: "Journal entry not found" }, { status: 404 })
    }

    const body = await request.json()
    const { document_url } = uploadDocumentSchema.parse(body)

    const updatedEntry = await prisma.journalEntry.update({
      where: { id: params.id },
      data: {
        supporting_document_url: document_url,
      },
      include: {
        journal_entry_lines: {
          include: {
            account: {
              select: {
                id: true,
                account_code: true,
                account_name: true,
              },
            },
          },
        },
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "JOURNAL_ENTRY_DOCUMENT_UPLOADED",
        resource: "journal_entry",
        resource_id: updatedEntry.id,
        new_values: { supporting_document_url: document_url },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedEntry,
    })
  } catch (error) {
    console.error("Error uploading supporting document:", error)
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
        error: error instanceof Error ? error.message : "Failed to upload supporting document",
      },
      { status: 500 }
    )
  }
}

