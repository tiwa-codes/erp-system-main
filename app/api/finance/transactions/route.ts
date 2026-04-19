import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { convertCurrencyAndLock } from "@/lib/currency"
import { RateType } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has finance permissions
    const hasPermission = await checkPermission(session.user.role as any, "finance", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const transactionType = searchParams.get("transactionType") || ""
    const status = searchParams.get("status") || ""
    const startDate = searchParams.get("startDate") || ""
    const endDate = searchParams.get("endDate") || ""

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.OR = [
        { reference_id: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    if (transactionType && transactionType !== "all") {
      where.transaction_type = transactionType
    }

    // Procurement payouts should only surface in finance after the workflow reaches finance stage.
    if (!transactionType || transactionType === "all" || transactionType === "PROCUREMENT_PAYOUT") {
      const financeStageInvoices = await prisma.procurementInvoice.findMany({
        where: {
          OR: [
            { status: { in: ["PENDING_FINANCE", "APPROVED", "PAID"] } },
            { status: "REJECTED", executive_at: { not: null } }
          ]
        },
        select: {
          id: true,
          invoice_number: true
        }
      })

      const allowedProcurementRefs = financeStageInvoices.flatMap((invoice) => [
        invoice.invoice_number,
        invoice.id
      ])

      if (transactionType === "PROCUREMENT_PAYOUT") {
        where.reference_id = { in: allowedProcurementRefs }
      } else {
        if (!where.AND) {
          where.AND = []
        }

        where.AND.push({
          OR: [
            { transaction_type: { not: "PROCUREMENT_PAYOUT" } },
            {
              transaction_type: "PROCUREMENT_PAYOUT",
              reference_id: { in: allowedProcurementRefs }
            }
          ]
        })
      }
    }

    if (status && status !== "all") {
      where.status = status
    }

    if (startDate && endDate) {
      where.created_at = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.financialTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          created_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          },
          general_ledger_entry: {
            select: {
              id: true
            }
          }
        }
      }),
      prisma.financialTransaction.count({ where })
    ])

    // Enrich PROCUREMENT_PAYOUT transactions with attachment data
    const procurementReferences = transactions
      .filter(t => t.transaction_type === 'PROCUREMENT_PAYOUT' && t.reference_id)
      .map(t => t.reference_id as string)

    let procurementMap: Record<string, {
      attachment_url: string | null
      attachment_name: string | null
      rejection_reason: string | null
      dept_oversight_comment: string | null
      dept_oversight_at: Date | null
      dept_oversight_by: {
        first_name: string | null
        last_name: string | null
        email: string | null
      } | null
      operations_comment: string | null
      operations_at: Date | null
      operations_by: {
        first_name: string | null
        last_name: string | null
        email: string | null
      } | null
      executive_comment: string | null
      executive_at: Date | null
      executive_by: {
        first_name: string | null
        last_name: string | null
        email: string | null
      } | null
    }> = {}
    if (procurementReferences.length > 0) {
      const invoices = await prisma.procurementInvoice.findMany({
        where: {
          OR: [
            { invoice_number: { in: procurementReferences } },
            { id: { in: procurementReferences } }
          ]
        },
        select: {
          id: true,
          invoice_number: true,
          attachment_url: true,
          attachment_name: true,
          rejection_reason: true,
          dept_oversight_comment: true,
          dept_oversight_at: true,
          dept_oversight_by: {
            select: {
              first_name: true,
              last_name: true,
              email: true,
            }
          },
          operations_comment: true,
          operations_at: true,
          operations_by: {
            select: {
              first_name: true,
              last_name: true,
              email: true,
            }
          },
          executive_comment: true,
          executive_at: true,
          executive_by: {
            select: {
              first_name: true,
              last_name: true,
              email: true,
            }
          },
        }
      })
      for (const inv of invoices) {
        const payload = {
          attachment_url: inv.attachment_url,
          attachment_name: inv.attachment_name,
          rejection_reason: inv.rejection_reason,
          dept_oversight_comment: inv.dept_oversight_comment,
          dept_oversight_at: inv.dept_oversight_at,
          dept_oversight_by: inv.dept_oversight_by,
          operations_comment: inv.operations_comment,
          operations_at: inv.operations_at,
          operations_by: inv.operations_by,
          executive_comment: inv.executive_comment,
          executive_at: inv.executive_at,
          executive_by: inv.executive_by,
        }

        procurementMap[inv.invoice_number] = payload
        procurementMap[inv.id] = payload
      }
    }

    const enrichedTransactions = transactions.map(t => {
      if (t.transaction_type === 'PROCUREMENT_PAYOUT' && t.reference_id && procurementMap[t.reference_id]) {
        return { ...t, ...procurementMap[t.reference_id] }
      }
      return t
    })

    return NextResponse.json({
      success: true,
      transactions: enrichedTransactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error("Error fetching financial transactions:", error)
    return NextResponse.json(
      { error: "Failed to fetch financial transactions" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has finance permissions
    const hasPermission = await checkPermission(session.user.role as any, "finance", "add")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const {
      transaction_type,
      amount,
      currency = "NGN",
      reference_id,
      reference_type,
      description,
      status = "PENDING"
    } = body

    if (!transaction_type || !amount) {
      return NextResponse.json({ error: "Transaction type and amount are required" }, { status: 400 })
    }

    let originalCurrency = currency
    let originalAmount: number | null = null
    let exchangeRateUsed: number | null = null
    let transactionAmount = parseFloat(amount)

    // If currency is not NGN, convert to NGN for foreign provider payments
    if (currency !== "NGN" && reference_type === "CLAIM_PAYOUT") {
      originalCurrency = currency
      originalAmount = transactionAmount

      // Convert to NGN and lock the rate
      const rateType = RateType.MID_MARKET
      const conversion = await convertCurrencyAndLock(
        transactionAmount,
        currency,
        "NGN",
        rateType
      )

      if (conversion) {
        transactionAmount = conversion.convertedAmount
        exchangeRateUsed = conversion.rate
      } else {
        console.error(
          `Failed to convert currency for financial transaction. Currency: ${currency}`
        )
        // Continue with original amount if conversion fails
      }
    }

    const transaction = await prisma.financialTransaction.create({
      data: {
        transaction_type,
        amount: transactionAmount, // Use converted amount in NGN
        currency: "NGN", // Always store base currency as NGN
        original_currency: originalCurrency,
        original_amount: originalAmount,
        exchange_rate_used: exchangeRateUsed,
        reference_id,
        reference_type,
        description,
        status,
        created_by_id: session.user.id
      },
      include: {
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "FINANCIAL_TRANSACTION_CREATE",
        resource: "financial_transaction",
        resource_id: transaction.id,
        new_values: transaction
      }
    })

    return NextResponse.json({
      success: true,
      transaction
    }, { status: 201 })

  } catch (error) {
    console.error("Error creating financial transaction:", error)
    return NextResponse.json(
      { error: "Failed to create financial transaction" },
      { status: 500 }
    )
  }
}
