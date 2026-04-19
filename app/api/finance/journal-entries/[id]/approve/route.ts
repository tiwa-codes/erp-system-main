import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { JournalEntryStatus } from "@prisma/client"
import { createGLEntry } from "@/lib/finance/gl-utils"

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
      include: {
        journal_entry_lines: true,
      },
    })

    if (!entry) {
      return NextResponse.json({ error: "Journal entry not found" }, { status: 404 })
    }

    if (entry.status !== JournalEntryStatus.PENDING_APPROVAL) {
      return NextResponse.json(
        {
          success: false,
          error: `Can only approve journal entries with PENDING_APPROVAL status. Current status: ${entry.status}`,
        },
        { status: 400 }
      )
    }

    // Update status to APPROVED and then auto-post to GL
    const updatedEntry = await prisma.$transaction(async (tx) => {
      // First, update status to APPROVED
      const approvedEntry = await tx.journalEntry.update({
        where: { id: params.id },
        data: {
          status: JournalEntryStatus.APPROVED,
          approved_by_id: session.user.id,
          approved_at: new Date(),
        },
        include: {
          journal_entry_lines: {
            include: {
              account: true,
            },
          },
          general_ledger_entries: true,
        },
      })

      // Check if already posted
      if (approvedEntry.general_ledger_entries.length > 0) {
        return approvedEntry
      }

      // Auto-post to GL - create GL entries for each line
      for (const line of approvedEntry.journal_entry_lines) {
        await createGLEntry({
          account_id: line.account_id,
          posting_type: line.posting_type,
          amount: Number(line.amount),
          transaction_date: approvedEntry.entry_date,
          reference_number: approvedEntry.entry_number,
          reference_type: "JOURNAL_ENTRY",
          reference_id: approvedEntry.id,
          description: line.description || approvedEntry.description,
          journal_entry_id: approvedEntry.id,
          created_by_id: session.user.id,
        })
      }

      // Update journal entry status to POSTED
      const postedEntry = await tx.journalEntry.update({
        where: { id: params.id },
        data: {
          status: JournalEntryStatus.POSTED,
          posted_at: new Date(),
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
          approved_by: {
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

      return postedEntry
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "JOURNAL_ENTRY_APPROVED_AND_POSTED",
        resource: "journal_entry",
        resource_id: updatedEntry.id,
        old_values: { status: entry.status },
        new_values: { status: updatedEntry.status, approved_by_id: session.user.id },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedEntry,
    })
  } catch (error) {
    console.error("Error approving journal entry:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to approve journal entry",
      },
      { status: 500 }
    )
  }
}

