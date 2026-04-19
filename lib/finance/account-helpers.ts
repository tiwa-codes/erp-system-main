import { prisma } from "@/lib/prisma"
import { AccountCategory } from "@prisma/client"

/**
 * Get account ID by account code
 */
export async function getAccountByCode(accountCode: number): Promise<string | null> {
  try {
    const account = await prisma.chartOfAccount.findUnique({
      where: { account_code: accountCode },
      select: { id: true },
    })
    return account?.id || null
  } catch {
    return null
  }
}

/**
 * Get account ID by account name (case-insensitive partial match)
 */
export async function getAccountByName(accountName: string): Promise<string | null> {
  try {
    const account = await prisma.chartOfAccount.findFirst({
      where: {
        account_name: {
          contains: accountName,
          mode: "insensitive",
        },
        is_active: true,
      },
      select: { id: true },
    })
    return account?.id || null
  } catch {
    return null
  }
}

/**
 * Get default accounts for common transactions
 * Returns account IDs for: claims expense, bank, premium income, accounts payable
 */
export async function getDefaultAccounts(): Promise<{
  claimsExpenseAccountId: string | null
  bankAccountId: string | null
  premiumIncomeAccountId: string | null
  accountsPayableAccountId: string | null
}> {
  // Try to find accounts by common codes first, then by name
  const claimsExpense =
    (await getAccountByCode(5201)) ||
    (await getAccountByName("Claims Expense")) ||
    (await getAccountByName("Claims"))

  const bank =
    (await getAccountByCode(1002)) ||
    (await getAccountByName("Cash at Bank")) ||
    (await getAccountByName("Bank"))

  const premiumIncome =
    (await getAccountByCode(4101)) ||
    (await getAccountByName("Premium Income")) ||
    (await getAccountByName("HMO Premium Income"))

  const accountsPayable =
    (await getAccountByCode(2001)) || (await getAccountByName("Accounts Payable"))

  return {
    claimsExpenseAccountId: claimsExpense,
    bankAccountId: bank,
    premiumIncomeAccountId: premiumIncome,
    accountsPayableAccountId: accountsPayable,
  }
}

