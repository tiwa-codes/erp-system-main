import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { createGLEntry } from "@/lib/finance/gl-utils"
import { PostingType } from "@prisma/client"
import { z } from "zod"

const postToGLSchema = z.object({
  debit_account_id: z.string().min(1, "Debit account is required"),
  credit_account_id: z.string().min(1, "Credit account is required"),
  description: z.string().optional(),
  entry_date: z.string().optional(), // ISO date string
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

    const hasPermission = await checkPermission(session.user.role as any, "finance", "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const transactionId = params.id

    // Get the transaction
    const transaction = await prisma.financialTransaction.findUnique({
      where: { id: transactionId },
      include: {
        general_ledger_entries: true,
      },
    })

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    // Check if already posted to GL
    if (transaction.general_ledger_entries && transaction.general_ledger_entries.length > 0) {
      return NextResponse.json(
        { error: "Transaction has already been posted to General Ledger" },
        { status: 400 }
      )
    }

    // Validate request body
    const body = await request.json()
    const validatedData = postToGLSchema.parse(body)

    // Validate accounts exist
    const [debitAccount, creditAccount] = await Promise.all([
      prisma.chartOfAccount.findUnique({
        where: { id: validatedData.debit_account_id },
      }),
      prisma.chartOfAccount.findUnique({
        where: { id: validatedData.credit_account_id },
      }),
    ])

    if (!debitAccount) {
      return NextResponse.json({ error: "Debit account not found" }, { status: 400 })
    }

    if (!creditAccount) {
      return NextResponse.json({ error: "Credit account not found" }, { status: 400 })
    }

    const entryDate = validatedData.entry_date
      ? new Date(validatedData.entry_date)
      : transaction.processed_at
      ? new Date(transaction.processed_at)
      : new Date()

    const description =
      validatedData.description ||
      transaction.description ||
      `${transaction.transaction_type} - ${transaction.reference_id || transaction.id}`

    // Create journal entry and post to GL
    await prisma.$transaction(async (tx) => {
      // Generate journal entry number (JE-YYYY-XXXXX format)
      const year = new Date(entryDate).getFullYear()
      const count = await tx.journalEntry.count({
        where: {
          entry_date: {
            gte: new Date(`${year}-01-01`),
            lt: new Date(`${year + 1}-01-01`),
          },
        },
      })
      const sequence = String(count + 1).padStart(5, "0")
      const entryNumber = `JE-${year}-${sequence}`

      // Create journal entry
      const journalEntry = await tx.journalEntry.create({
        data: {
          entry_number: entryNumber,
          entry_date: entryDate,
          entry_type: "MANUAL",
          status: "POSTED", // Post directly to GL
          description,
          total_debit: transaction.amount,
          total_credit: transaction.amount,
          posted_at: new Date(),
          created_by_id: session.user.id,
        },
      })

      // Create journal entry lines
      await tx.journalEntryLine.createMany({
        data: [
          {
            journal_entry_id: journalEntry.id,
            account_id: validatedData.debit_account_id,
            posting_type: PostingType.DEBIT,
            amount: transaction.amount,
            description,
          },
          {
            journal_entry_id: journalEntry.id,
            account_id: validatedData.credit_account_id,
            posting_type: PostingType.CREDIT,
            amount: transaction.amount,
            description,
          },
        ],
      })

      // Post to GL
      await Promise.all([
        createGLEntry({
          account_id: validatedData.debit_account_id,
          posting_type: PostingType.DEBIT,
          amount: Number(transaction.amount),
          transaction_date: entryDate,
          reference_number: transaction.reference_id || entryNumber,
          reference_type: transaction.reference_type || "FINANCIAL_TRANSACTION",
          reference_id: transaction.id,
          description,
          journal_entry_id: journalEntry.id,
          created_by_id: session.user.id,
        }),
        createGLEntry({
          account_id: validatedData.credit_account_id,
          posting_type: PostingType.CREDIT,
          amount: Number(transaction.amount),
          transaction_date: entryDate,
          reference_number: transaction.reference_id || entryNumber,
          reference_type: transaction.reference_type || "FINANCIAL_TRANSACTION",
          reference_id: transaction.id,
          description,
          journal_entry_id: journalEntry.id,
          created_by_id: session.user.id,
        }),
      ])
    })

    // Fetch updated transaction
    const updatedTransaction = await prisma.financialTransaction.findUnique({
      where: { id: transactionId },
      include: {
        general_ledger_entries: {
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
        action: "FINANCIAL_TRANSACTION_POSTED_TO_GL",
        resource: "financial_transaction",
        resource_id: transactionId,
        new_values: {
          debit_account_id: validatedData.debit_account_id,
          credit_account_id: validatedData.credit_account_id,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: "Transaction posted to General Ledger successfully",
      data: updatedTransaction,
    })
  } catch (error) {
    console.error("Error posting transaction to GL:", error)
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
        error: error instanceof Error ? error.message : "Failed to post transaction to GL",
      },
      { status: 500 }
    )
  }
}



