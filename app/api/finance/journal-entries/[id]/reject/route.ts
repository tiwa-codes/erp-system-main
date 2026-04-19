import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { JournalEntryStatus } from "@prisma/client"
import { z } from "zod"

const rejectSchema = z.object({
  rejection_reason: z.string().min(1, "Rejection reason is required"),
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

    const canApprove = await checkPermission(session.user.role as any, "finance", "approve")
    if (!canApprove) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const entry = await prisma.journalEntry.findUnique({
      where: { id: params.id },
    })

    if (!entry) {
      return NextResponse.json({ error: "Journal entry not found" }, { status: 404 })
    }

    if (entry.status !== JournalEntryStatus.PENDING_APPROVAL) {
      return NextResponse.json(
        {
          success: false,
          error: `Can only reject journal entries with PENDING_APPROVAL status. Current status: ${entry.status}`,
        },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { rejection_reason } = rejectSchema.parse(body)

    const updatedEntry = await prisma.journalEntry.update({
      where: { id: params.id },
      data: {
        status: JournalEntryStatus.REJECTED,
        rejection_reason,
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
        action: "JOURNAL_ENTRY_REJECTED",
        resource: "journal_entry",
        resource_id: updatedEntry.id,
        old_values: { status: entry.status },
        new_values: {
          status: updatedEntry.status,
          rejection_reason: updatedEntry.rejection_reason,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedEntry,
    })
  } catch (error) {
    console.error("Error rejecting journal entry:", error)
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
        error: error instanceof Error ? error.message : "Failed to reject journal entry",
      },
      { status: 500 }
    )
  }
}

