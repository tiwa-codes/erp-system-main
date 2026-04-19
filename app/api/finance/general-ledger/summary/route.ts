import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { PostingType } from "@prisma/client"

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
    const toDate = searchParams.get("to_date")
    const accountIds = searchParams.get("account_ids")?.split(",").filter(Boolean)

    const where: any = {}

    if (accountIds && accountIds.length > 0) {
      where.account_id = { in: accountIds }
    }

    if (fromDate || toDate) {
      where.transaction_date = {}
      if (fromDate) {
        where.transaction_date.gte = new Date(fromDate)
      }
      if (toDate) {
        where.transaction_date.lte = new Date(toDate)
      }
    }

    // Get all accounts with their summaries
    const accounts = await prisma.chartOfAccount.findMany({
      where: accountIds ? { id: { in: accountIds } } : {},
      include: {
        _count: {
          select: {
            general_ledger_entries: {
              where: fromDate || toDate
                ? {
                    transaction_date: {
                      ...(fromDate && { gte: new Date(fromDate) }),
                      ...(toDate && { lte: new Date(toDate) }),
                    },
                  }
                : {},
            },
          },
        },
      },
    })

    const summaries = await Promise.all(
      accounts.map(async (account) => {
        const [debits, credits] = await Promise.all([
          prisma.generalLedger.aggregate({
            where: {
              ...where,
              account_id: account.id,
              posting_type: PostingType.DEBIT,
            },
            _sum: {
              amount: true,
            },
          }),
          prisma.generalLedger.aggregate({
            where: {
              ...where,
              account_id: account.id,
              posting_type: PostingType.CREDIT,
            },
            _sum: {
              amount: true,
            },
          }),
        ])

        const openingBalance = Number(account.opening_balance)
        const totalDebits = Number(debits._sum.amount || 0)
        const totalCredits = Number(credits._sum.amount || 0)

        // Calculate balance based on account category
        let balance: number
        if (
          account.account_category === "ASSET" ||
          account.account_category === "EXPENSE"
        ) {
          balance = openingBalance + totalDebits - totalCredits
        } else {
          balance = openingBalance - totalDebits + totalCredits
        }

        return {
          account_id: account.id,
          account_code: account.account_code,
          account_name: account.account_name,
          account_category: account.account_category,
          opening_balance: openingBalance,
          total_debits: totalDebits,
          total_credits: totalCredits,
          balance,
          entry_count: account._count.general_ledger_entries,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        summaries,
        date_range: {
          from_date: fromDate || null,
          to_date: toDate || null,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching GL summary:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch GL summary",
      },
      { status: 500 }
    )
  }
}

