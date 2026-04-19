import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { JournalEntryStatus, PostingType } from "@prisma/client"
import { z } from "zod"
import { validateJournalEntry } from "@/lib/finance/gl-utils"

const updateJournalEntrySchema = z.object({
  entry_date: z.string().transform((str) => new Date(str)).optional(),
  description: z.string().min(1).optional(),
  supporting_document_url: z.string().optional().nullable(),
  lines: z
    .array(
      z.object({
        account_id: z.string(),
        posting_type: z.nativeEnum(PostingType),
        amount: z.number().positive(),
        description: z.string().optional(),
      })
    )
    .min(2, "At least 2 lines required (one debit, one credit)")
    .optional(),
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

    const canView = await checkPermission(session.user.role as any, "finance", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const entry = await prisma.journalEntry.findUnique({
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
                account_category: true,
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

    if (!entry) {
      return NextResponse.json({ error: "Journal entry not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: entry,
    })
  } catch (error) {
    console.error("Error fetching journal entry:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch journal entry",
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

    const canEdit = await checkPermission(session.user.role as any, "finance", "edit")
    if (!canEdit) {
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

    // Only allow editing if status is DRAFT or PENDING_APPROVAL
    if (entry.status !== JournalEntryStatus.DRAFT && entry.status !== JournalEntryStatus.PENDING_APPROVAL) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot edit journal entry with status ${entry.status}`,
        },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = updateJournalEntrySchema.parse(body)

    // If lines are provided, validate them
    if (validatedData.lines) {
      const validation = validateJournalEntry(validatedData.lines)
      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: validation.error,
          },
          { status: 400 }
        )
      }
    }

    const oldValues = { ...entry }

    // Update journal entry
    const updatedEntry = await prisma.$transaction(async (tx) => {
      // Calculate new totals if lines are updated
      let totalDebit = entry.total_debit
      let totalCredit = entry.total_credit

      if (validatedData.lines) {
        totalDebit = validatedData.lines
          .filter((line) => line.posting_type === PostingType.DEBIT)
          .reduce((sum, line) => sum + line.amount, 0)

        totalCredit = validatedData.lines
          .filter((line) => line.posting_type === PostingType.CREDIT)
          .reduce((sum, line) => sum + line.amount, 0)

        // Delete existing lines
        await tx.journalEntryLine.deleteMany({
          where: { journal_entry_id: params.id },
        })

        // Create new lines
        await tx.journalEntryLine.createMany({
          data: validatedData.lines.map((line) => ({
            journal_entry_id: params.id,
            account_id: line.account_id,
            posting_type: line.posting_type,
            amount: line.amount,
            description: line.description,
          })),
        })
      }

      // Update journal entry
      const updated = await tx.journalEntry.update({
        where: { id: params.id },
        data: {
          ...(validatedData.entry_date && { entry_date: validatedData.entry_date }),
          ...(validatedData.description && { description: validatedData.description }),
          ...(validatedData.supporting_document_url !== undefined && {
            supporting_document_url: validatedData.supporting_document_url,
          }),
          ...(validatedData.lines && {
            total_debit: totalDebit,
            total_credit: totalCredit,
          }),
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

      return updated
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "JOURNAL_ENTRY_UPDATED",
        resource: "journal_entry",
        resource_id: updatedEntry.id,
        old_values: oldValues,
        new_values: updatedEntry,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedEntry,
    })
  } catch (error) {
    console.error("Error updating journal entry:", error)
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
        error: error instanceof Error ? error.message : "Failed to update journal entry",
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

    // Only allow deletion if status is DRAFT
    if (entry.status !== JournalEntryStatus.DRAFT) {
      return NextResponse.json(
        {
          success: false,
          error: "Can only delete journal entries with DRAFT status",
        },
        { status: 400 }
      )
    }

    await prisma.journalEntry.delete({
      where: { id: params.id },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "JOURNAL_ENTRY_DELETED",
        resource: "journal_entry",
        resource_id: params.id,
        old_values: entry,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Journal entry deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting journal entry:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete journal entry",
      },
      { status: 500 }
    )
  }
}

