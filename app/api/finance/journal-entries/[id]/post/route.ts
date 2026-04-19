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

    const canEdit = await checkPermission(session.user.role as any, "finance", "edit")
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const entry = await prisma.journalEntry.findUnique({
      where: { id: params.id },
      include: {
        journal_entry_lines: {
          include: {
            account: true,
          },
        },
        general_ledger_entries: true,
      },
    })

    if (!entry) {
      return NextResponse.json({ error: "Journal entry not found" }, { status: 404 })
    }

    if (entry.status === JournalEntryStatus.POSTED) {
      return NextResponse.json({
        success: true,
        data: entry,
      })
    }

    const canPostDirectly = [
      JournalEntryStatus.DRAFT,
      JournalEntryStatus.PENDING_APPROVAL,
      JournalEntryStatus.APPROVED,
    ].includes(entry.status)

    if (!canPostDirectly) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot post journal entry with status ${entry.status}`,
        },
        { status: 400 }
      )
    }

    // Check if already posted
    if (entry.general_ledger_entries.length > 0) {
      const alreadyPosted = await prisma.journalEntry.update({
        where: { id: params.id },
        data: {
          status: JournalEntryStatus.POSTED,
          posted_at: entry.posted_at || new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        data: alreadyPosted,
      })
    }

    // Post to GL - create GL entries for each line
    await prisma.$transaction(async (tx) => {
      for (const line of entry.journal_entry_lines) {
        await createGLEntry({
          account_id: line.account_id,
          posting_type: line.posting_type,
          amount: Number(line.amount),
          transaction_date: entry.entry_date,
          reference_number: entry.entry_number,
          reference_type: "JOURNAL_ENTRY",
          reference_id: entry.id,
          description: line.description || entry.description,
          journal_entry_id: entry.id,
          created_by_id: session.user.id,
        })
      }

      // Update journal entry status to POSTED
      await tx.journalEntry.update({
        where: { id: params.id },
        data: {
          status: JournalEntryStatus.POSTED,
          approved_by_id: entry.approved_by_id || session.user.id,
          approved_at: entry.approved_at || new Date(),
          posted_at: new Date(),
        },
      })
    })

    // Fetch updated entry
    const updatedEntry = await prisma.journalEntry.findUnique({
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
        general_ledger_entries: {
          select: {
            id: true,
            entry_number: true,
            transaction_date: true,
          },
        },
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "JOURNAL_ENTRY_POSTED",
        resource: "journal_entry",
        resource_id: updatedEntry!.id,
        old_values: { status: entry.status },
        new_values: { status: updatedEntry!.status, posted_at: updatedEntry!.posted_at },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedEntry,
    })
  } catch (error) {
    console.error("Error posting journal entry:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to post journal entry",
      },
      { status: 500 }
    )
  }
}

