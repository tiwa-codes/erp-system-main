import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { AccountCategory } from "@prisma/client"
import { calculateAccountBalance } from "@/lib/finance/gl-utils"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "finance", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get("from_date")
      ? new Date(searchParams.get("from_date")!)
      : new Date(new Date().getFullYear(), 0, 1)
    const toDate = searchParams.get("to_date")
      ? new Date(searchParams.get("to_date")!)
      : new Date()

    // Get income accounts
    const incomeAccounts = await prisma.chartOfAccount.findMany({
      where: {
        account_category: AccountCategory.INCOME,
        is_active: true,
      },
      orderBy: { account_code: "asc" },
    })

    // Get expense accounts
    const expenseAccounts = await prisma.chartOfAccount.findMany({
      where: {
        account_category: AccountCategory.EXPENSE,
        is_active: true,
      },
      orderBy: { account_code: "asc" },
    })

    // Calculate income
    const incomeEntries = await Promise.all(
      incomeAccounts.map(async (account) => {
        const balanceData = await calculateAccountBalance(account.id, toDate)
        // For income accounts, we want the period activity (credits - debits)
        // But since calculateAccountBalance gives us closing balance,
        // we need to get period transactions
        const openingBalanceData = await calculateAccountBalance(account.id, fromDate)

        const periodIncome =
          balanceData.current_balance - openingBalanceData.current_balance

        return {
          account_id: account.id,
          account_code: account.account_code,
          account_name: account.account_name,
          amount: Math.max(0, periodIncome), // Income should be positive
        }
      })
    )

    // Calculate expenses
    const expenseEntries = await Promise.all(
      expenseAccounts.map(async (account) => {
        const balanceData = await calculateAccountBalance(account.id, toDate)
        const openingBalanceData = await calculateAccountBalance(account.id, fromDate)

        const periodExpense =
          balanceData.current_balance - openingBalanceData.current_balance

        return {
          account_id: account.id,
          account_code: account.account_code,
          account_name: account.account_name,
          amount: Math.max(0, periodExpense), // Expenses should be positive
        }
      })
    )

    const totalIncome = incomeEntries.reduce((sum, entry) => sum + entry.amount, 0)
    const totalExpenses = expenseEntries.reduce((sum, entry) => sum + entry.amount, 0)
    const netProfit = totalIncome - totalExpenses

    return NextResponse.json({
      success: true,
      data: {
        income: {
          entries: incomeEntries.filter((e) => e.amount > 0),
          total: totalIncome,
        },
        expenses: {
          entries: expenseEntries.filter((e) => e.amount > 0),
          total: totalExpenses,
        },
        net_profit: netProfit,
        date_range: {
          from_date: fromDate.toISOString(),
          to_date: toDate.toISOString(),
        },
      },
    })
  } catch (error) {
    console.error("Error calculating profit & loss:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to calculate profit & loss",
      },
      { status: 500 }
    )
  }
}

