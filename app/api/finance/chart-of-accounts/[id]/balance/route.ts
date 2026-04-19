import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { PostingType } from "@prisma/client"

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

    const account = await prisma.chartOfAccount.findUnique({
      where: { id: params.id },
    })

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const asOfDate = searchParams.get("as_of_date")
      ? new Date(searchParams.get("as_of_date")!)
      : new Date()

    // Calculate balance: opening_balance + total_debits - total_credits
    const [totalDebits, totalCredits] = await Promise.all([
      prisma.generalLedger.aggregate({
        where: {
          account_id: params.id,
          posting_type: PostingType.DEBIT,
          transaction_date: { lte: asOfDate },
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.generalLedger.aggregate({
        where: {
          account_id: params.id,
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
      account.account_category === "ASSET" ||
      account.account_category === "EXPENSE"
    ) {
      currentBalance = openingBalance + debits - credits
    } else {
      currentBalance = openingBalance - debits + credits
    }

    return NextResponse.json({
      success: true,
      data: {
        account_id: account.id,
        account_code: account.account_code,
        account_name: account.account_name,
        opening_balance: openingBalance,
        total_debits: debits,
        total_credits: credits,
        current_balance: currentBalance,
        as_of_date: asOfDate.toISOString(),
      },
    })
  } catch (error) {
    console.error("Error calculating account balance:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to calculate account balance",
      },
      { status: 500 }
    )
  }
}

