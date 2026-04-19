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
    const asOfDate = searchParams.get("as_of_date")
      ? new Date(searchParams.get("as_of_date")!)
      : new Date()

    // Get asset accounts
    const assetAccounts = await prisma.chartOfAccount.findMany({
      where: {
        account_category: AccountCategory.ASSET,
        is_active: true,
      },
      orderBy: { account_code: "asc" },
    })

    // Get liability accounts
    const liabilityAccounts = await prisma.chartOfAccount.findMany({
      where: {
        account_category: AccountCategory.LIABILITY,
        is_active: true,
      },
      orderBy: { account_code: "asc" },
    })

    // Get equity accounts
    const equityAccounts = await prisma.chartOfAccount.findMany({
      where: {
        account_category: AccountCategory.EQUITY,
        is_active: true,
      },
      orderBy: { account_code: "asc" },
    })

    // Calculate balances for each category
    const assetEntries = await Promise.all(
      assetAccounts.map(async (account) => {
        const balanceData = await calculateAccountBalance(account.id, asOfDate)
        return {
          account_id: account.id,
          account_code: account.account_code,
          account_name: account.account_name,
          balance: balanceData.current_balance,
        }
      })
    )

    const liabilityEntries = await Promise.all(
      liabilityAccounts.map(async (account) => {
        const balanceData = await calculateAccountBalance(account.id, asOfDate)
        return {
          account_id: account.id,
          account_code: account.account_code,
          account_name: account.account_name,
          balance: balanceData.current_balance,
        }
      })
    )

    const equityEntries = await Promise.all(
      equityAccounts.map(async (account) => {
        const balanceData = await calculateAccountBalance(account.id, asOfDate)
        return {
          account_id: account.id,
          account_code: account.account_code,
          account_name: account.account_name,
          balance: balanceData.current_balance,
        }
      })
    )

    const totalAssets = assetEntries.reduce((sum, entry) => sum + entry.balance, 0)
    const totalLiabilities = liabilityEntries.reduce((sum, entry) => sum + entry.balance, 0)
    const totalEquity = equityEntries.reduce((sum, entry) => sum + entry.balance, 0)

    // Validation: Assets = Liabilities + Equity
    const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01

    return NextResponse.json({
      success: true,
      data: {
        assets: {
          entries: assetEntries,
          total: totalAssets,
        },
        liabilities: {
          entries: liabilityEntries,
          total: totalLiabilities,
        },
        equity: {
          entries: equityEntries,
          total: totalEquity,
        },
        is_balanced: isBalanced,
        balance_equation: {
          assets: totalAssets,
          liabilities_plus_equity: totalLiabilities + totalEquity,
          difference: totalAssets - (totalLiabilities + totalEquity),
        },
        as_of_date: asOfDate.toISOString(),
      },
    })
  } catch (error) {
    console.error("Error calculating balance sheet:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to calculate balance sheet",
      },
      { status: 500 }
    )
  }
}

