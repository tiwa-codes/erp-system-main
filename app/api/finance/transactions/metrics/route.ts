import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

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

    // Get transaction metrics
    const [
      totalTransactions,
      pendingTransactions,
      processedTransactions,
      failedTransactions,
      totalAmount,
      claimPayouts,
      refunds,
      adjustments,
      transfers
    ] = await Promise.all([
      prisma.financialTransaction.count(),
      prisma.financialTransaction.count({ where: { status: "PENDING" } }),
      prisma.financialTransaction.count({ where: { status: "PROCESSED" } }),
      prisma.financialTransaction.count({ where: { status: "FAILED" } }),
      prisma.financialTransaction.aggregate({
        where: { status: "PROCESSED" },
        _sum: { amount: true }
      }),
      prisma.financialTransaction.count({ where: { transaction_type: "CLAIM_PAYOUT" } }),
      prisma.financialTransaction.count({ where: { transaction_type: "REFUND" } }),
      prisma.financialTransaction.count({ where: { transaction_type: "ADJUSTMENT" } }),
      prisma.financialTransaction.count({ where: { transaction_type: "TRANSFER" } })
    ])

    const metrics = {
      total_transactions: totalTransactions,
      pending_transactions: pendingTransactions,
      processed_transactions: processedTransactions,
      failed_transactions: failedTransactions,
      total_amount: totalAmount._sum.amount || 0,
      claim_payouts: claimPayouts,
      refunds: refunds,
      adjustments: adjustments,
      transfers: transfers
    }

    return NextResponse.json({
      success: true,
      metrics
    })

  } catch (error) {
    console.error("Error fetching transaction metrics:", error)
    return NextResponse.json(
      { error: "Failed to fetch transaction metrics" },
      { status: 500 }
    )
  }
}
