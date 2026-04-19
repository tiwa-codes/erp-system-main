import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { PostingType, AccountCategory } from "@prisma/client"
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
      : new Date(new Date().getFullYear(), 0, 1) // Start of year
    const toDate = searchParams.get("to_date")
      ? new Date(searchParams.get("to_date")!)
      : new Date()

    // Get all active accounts
    const accounts = await prisma.chartOfAccount.findMany({
      where: { is_active: true },
      orderBy: [{ account_category: "asc" }, { account_code: "asc" }],
    })

    // Calculate trial balance for each account
    const trialBalanceEntries = await Promise.all(
      accounts.map(async (account) => {
        // Get opening balance (before fromDate)
        const openingBalanceData = await calculateAccountBalance(account.id, fromDate)

        // Get transactions in the period
        const [periodDebitsResult, periodCreditsResult] = await Promise.all([
          prisma.generalLedger.aggregate({
            where: {
              account_id: account.id,
              posting_type: PostingType.DEBIT,
              transaction_date: {
                gte: fromDate,
                lte: toDate,
              },
            },
            _sum: {
              amount: true,
            },
          }),
          prisma.generalLedger.aggregate({
            where: {
              account_id: account.id,
              posting_type: PostingType.CREDIT,
              transaction_date: {
                gte: fromDate,
                lte: toDate,
              },
            },
            _sum: {
              amount: true,
            },
          }),
        ])

        const openingBalance = openingBalanceData.opening_balance
        const periodDebits = Number(periodDebitsResult._sum.amount || 0)
        const periodCredits = Number(periodCreditsResult._sum.amount || 0)

        // Calculate closing balance
        let closingBalance: number
        if (
          account.account_category === AccountCategory.ASSET ||
          account.account_category === AccountCategory.EXPENSE
        ) {
          closingBalance = openingBalance + periodDebits - periodCredits
        } else {
          closingBalance = openingBalance - periodDebits + periodCredits
        }

        return {
          account_id: account.id,
          account_code: account.account_code,
          account_name: account.account_name,
          account_category: account.account_category,
          opening_balance: openingBalance,
          total_debits: periodDebits,
          total_credits: periodCredits,
          closing_balance: closingBalance,
        }
      })
    )

    // Calculate totals
    const totals = trialBalanceEntries.reduce(
      (acc, entry) => {
        acc.total_opening_debits +=
          entry.account_category === AccountCategory.ASSET ||
          entry.account_category === AccountCategory.EXPENSE
            ? entry.opening_balance
            : 0
        acc.total_opening_credits +=
          entry.account_category === AccountCategory.LIABILITY ||
          entry.account_category === AccountCategory.EQUITY ||
          entry.account_category === AccountCategory.INCOME
            ? entry.opening_balance
            : 0
        acc.total_debits += entry.total_debits
        acc.total_credits += entry.total_credits
        acc.total_closing_debits +=
          entry.account_category === AccountCategory.ASSET ||
          entry.account_category === AccountCategory.EXPENSE
            ? entry.closing_balance
            : 0
        acc.total_closing_credits +=
          entry.account_category === AccountCategory.LIABILITY ||
          entry.account_category === AccountCategory.EQUITY ||
          entry.account_category === AccountCategory.INCOME
            ? entry.closing_balance
            : 0
        return acc
      },
      {
        total_opening_debits: 0,
        total_opening_credits: 0,
        total_debits: 0,
        total_credits: 0,
        total_closing_debits: 0,
        total_closing_credits: 0,
      }
    )

    // Validation: Total debits must equal total credits
    const isBalanced =
      Math.abs(totals.total_debits - totals.total_credits) < 0.01 &&
      Math.abs(totals.total_closing_debits - totals.total_closing_credits) < 0.01

    return NextResponse.json({
      success: true,
      data: {
        entries: trialBalanceEntries,
        totals,
        is_balanced: isBalanced,
        date_range: {
          from_date: fromDate.toISOString(),
          to_date: toDate.toISOString(),
        },
      },
    })
  } catch (error) {
    console.error("Error calculating trial balance:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to calculate trial balance",
      },
      { status: 500 }
    )
  }
}

