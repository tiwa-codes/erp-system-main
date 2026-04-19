import { prisma } from "@/lib/prisma"
import { PostingType, AccountCategory, Prisma } from "@prisma/client"

export interface CreateGLEntryParams {
  account_id: string
  posting_type: PostingType
  amount: number
  transaction_date: Date
  reference_number?: string
  reference_type?: string
  reference_id?: string
  description?: string
  module?: string
  journal_entry_id?: string
  created_by_id: string
}

/**
 * Generate unique GL entry number
 */
export async function generateEntryNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await prisma.generalLedger.count({
    where: {
      transaction_date: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
  })
  const sequence = String(count + 1).padStart(6, "0")
  return `GL-${year}-${sequence}`
}

/**
 * Create a General Ledger entry
 */
export async function createGLEntry(params: CreateGLEntryParams): Promise<any> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const baseEntryNumber = await generateEntryNumber()
    const entry_number = attempt === 0 ? baseEntryNumber : `${baseEntryNumber}-${attempt}`

    try {
      const glEntry = await prisma.generalLedger.create({
        data: {
          entry_number,
          account_id: params.account_id,
          posting_type: params.posting_type,
          amount: params.amount,
          transaction_date: params.transaction_date,
          reference_number: params.reference_number,
          reference_type: params.reference_type,
          reference_id: params.reference_id,
          description: params.description,
          module: params.module,
          journal_entry_id: params.journal_entry_id,
          created_by_id: params.created_by_id,
        },
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
      })

      return glEntry
    } catch (error) {
      const isDuplicateEntryNumber =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        Array.isArray((error.meta as any)?.target) &&
        ((error.meta as any).target as string[]).includes("entry_number")

      if (!isDuplicateEntryNumber || attempt === 4) {
        throw error
      }
    }
  }

  throw new Error("Failed to create GL entry")
}

/**
 * Create system-generated journal entry from transaction
 */
export async function createJournalEntryFromTransaction(
  params: {
    entry_date: Date
    description: string
    debit_account_id: string
    credit_account_id: string
    amount: number
    reference_number?: string
    reference_type?: string
    reference_id?: string
    module?: string
    created_by_id: string
  }
): Promise<any> {
  // Generate journal entry number
  const year = new Date().getFullYear()
  const count = await prisma.journalEntry.count({
    where: {
      entry_date: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
  })
  const sequence = String(count + 1).padStart(5, "0")
  const entry_number = `JE-${year}-${sequence}`

  // Create journal entry
  const journalEntry = await prisma.journalEntry.create({
    data: {
      entry_number,
      entry_date: params.entry_date,
      entry_type: "SYSTEM_GENERATED",
      status: "APPROVED", // Auto-approve system entries
      description: params.description,
      total_debit: params.amount,
      total_credit: params.amount,
      created_by_id: params.created_by_id,
      approved_by_id: params.created_by_id,
      approved_at: new Date(),
    },
  })

  // Create journal entry lines
  await Promise.all([
    prisma.journalEntryLine.create({
      data: {
        journal_entry_id: journalEntry.id,
        account_id: params.debit_account_id,
        posting_type: PostingType.DEBIT,
        amount: params.amount,
        description: params.description,
      },
    }),
    prisma.journalEntryLine.create({
      data: {
        journal_entry_id: journalEntry.id,
        account_id: params.credit_account_id,
        posting_type: PostingType.CREDIT,
        amount: params.amount,
        description: params.description,
      },
    }),
  ])

  // Post to GL immediately
  await Promise.all([
    createGLEntry({
      account_id: params.debit_account_id,
      posting_type: PostingType.DEBIT,
      amount: params.amount,
      transaction_date: params.entry_date,
      reference_number: params.reference_number,
      reference_type: params.reference_type,
      reference_id: params.reference_id,
      description: params.description,
      module: params.module,
      journal_entry_id: journalEntry.id,
      created_by_id: params.created_by_id,
    }),
    createGLEntry({
      account_id: params.credit_account_id,
      posting_type: PostingType.CREDIT,
      amount: params.amount,
      transaction_date: params.entry_date,
      reference_number: params.reference_number,
      reference_type: params.reference_type,
      reference_id: params.reference_id,
      description: params.description,
      module: params.module,
      journal_entry_id: journalEntry.id,
      created_by_id: params.created_by_id,
    }),
  ])

  // Update journal entry status to POSTED
  await prisma.journalEntry.update({
    where: { id: journalEntry.id },
    data: {
      status: "POSTED",
      posted_at: new Date(),
    },
  })

  return journalEntry
}

/**
 * Validate journal entry - debits must equal credits
 */
export function validateJournalEntry(
  lines: Array<{ posting_type: PostingType; amount: number }>
): { valid: boolean; error?: string } {
  const totalDebits = lines
    .filter((line) => line.posting_type === PostingType.DEBIT)
    .reduce((sum, line) => sum + Number(line.amount), 0)

  const totalCredits = lines
    .filter((line) => line.posting_type === PostingType.CREDIT)
    .reduce((sum, line) => sum + Number(line.amount), 0)

  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    return {
      valid: false,
      error: `Total debits (${totalDebits.toFixed(2)}) must equal total credits (${totalCredits.toFixed(2)})`,
    }
  }

  return { valid: true }
}

/**
 * Calculate account balance as of a specific date
 */
export async function calculateAccountBalance(
  account_id: string,
  asOfDate: Date = new Date()
): Promise<{
  opening_balance: number
  total_debits: number
  total_credits: number
  current_balance: number
}> {
  const account = await prisma.chartOfAccount.findUnique({
    where: { id: account_id },
  })

  if (!account) {
    throw new Error("Account not found")
  }

  const [totalDebits, totalCredits] = await Promise.all([
    prisma.generalLedger.aggregate({
      where: {
        account_id,
        posting_type: PostingType.DEBIT,
        transaction_date: { lte: asOfDate },
      },
      _sum: {
        amount: true,
      },
    }),
    prisma.generalLedger.aggregate({
      where: {
        account_id,
        posting_type: PostingType.CREDIT,
        transaction_date: { lte: asOfDate },
      },
      _sum: {
        amount: true,
      },
    }),
  ])

  const openingBalance = Number(account.opening_balance)
  const debits = Number(totalDebits._sum.amount || 0)
  const credits = Number(totalCredits._sum.amount || 0)

  // For Asset and Expense accounts: opening + debits - credits
  // For Liability, Equity, and Income accounts: opening - debits + credits
  let currentBalance: number
  if (
    account.account_category === AccountCategory.ASSET ||
    account.account_category === AccountCategory.EXPENSE
  ) {
    currentBalance = openingBalance + debits - credits
  } else {
    currentBalance = openingBalance - debits + credits
  }

  return {
    opening_balance: openingBalance,
    total_debits: debits,
    total_credits: credits,
    current_balance: currentBalance,
  }
}

