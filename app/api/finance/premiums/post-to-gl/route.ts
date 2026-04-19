import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { createJournalEntryFromTransaction } from "@/lib/finance/gl-utils"
import { getDefaultAccounts } from "@/lib/finance/account-helpers"
import { z } from "zod"

const postPremiumSchema = z.object({
  principal_id: z.string(),
  amount: z.number().positive(),
  reference_number: z.string().optional(),
  description: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canEdit = await checkPermission(session.user.role as any, "finance", "edit")
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = postPremiumSchema.parse(body)

    // Get principal details
    const principal = await prisma.principal.findUnique({
      where: { id: validatedData.principal_id },
      include: {
        organization: true,
      },
    })

    if (!principal) {
      return NextResponse.json({ error: "Principal not found" }, { status: 404 })
    }

    // Get default accounts
    const accounts = await getDefaultAccounts()
    if (!accounts.bankAccountId || !accounts.premiumIncomeAccountId) {
      return NextResponse.json(
        {
          success: false,
          error: "Required accounts not configured. Please set up Bank Account and Premium Income Account in Chart of Accounts.",
        },
        { status: 400 }
      )
    }

    // Create journal entry: Debit Bank, Credit Premium Income
    const journalEntry = await createJournalEntryFromTransaction({
      entry_date: new Date(),
      description:
        validatedData.description ||
        `Premium payment from ${principal.organization?.name || principal.first_name} ${principal.last_name}`,
      debit_account_id: accounts.bankAccountId,
      credit_account_id: accounts.premiumIncomeAccountId,
      amount: validatedData.amount,
      reference_number: validatedData.reference_number || `PREMIUM-${Date.now()}`,
      reference_type: "PREMIUM",
      reference_id: validatedData.principal_id,
      module: "underwriting",
      created_by_id: session.user.id,
    })

    // Create financial transaction record
    await prisma.financialTransaction.create({
      data: {
        transaction_type: "REFUND", // Using REFUND as closest match, or we could add PREMIUM_INCOME
        amount: validatedData.amount,
        currency: "NGN",
        reference_id: validatedData.reference_number || `PREMIUM-${Date.now()}`,
        reference_type: "PREMIUM",
        description:
          validatedData.description ||
          `Premium payment from ${principal.organization?.name || principal.first_name} ${principal.last_name}`,
        status: "PAID",
        processed_at: new Date(),
        created_by_id: session.user.id,
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "PREMIUM_POSTED_TO_GL",
        resource: "premium",
        resource_id: validatedData.principal_id,
        new_values: {
          amount: validatedData.amount,
          reference_number: validatedData.reference_number,
          journal_entry_id: journalEntry.id,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: "Premium posted to General Ledger successfully",
      data: {
        journal_entry_id: journalEntry.id,
        amount: validatedData.amount,
      },
    })
  } catch (error) {
    console.error("Error posting premium to GL:", error)
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
        error: error instanceof Error ? error.message : "Failed to post premium to GL",
      },
      { status: 500 }
    )
  }
}

