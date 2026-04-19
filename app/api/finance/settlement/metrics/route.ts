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

    // Get settlement metrics
    const [
      pendingPayouts,
      totalPayouts,
      totalAmount,
      processedToday
    ] = await Promise.all([
      // Pending payouts (claims approved but not paid)
      prisma.claim.count({
        where: { 
          status: 'APPROVED',
          payouts: {
            none: {
              status: 'PROCESSED'
            }
          }
        }
      }),
      // Total payouts (all processed payouts)
      prisma.payout.count({
        where: { status: 'PROCESSED' }
      }),
      // Total amount processed
      prisma.payout.aggregate({
        where: { status: 'PROCESSED' },
        _sum: { amount: true }
      }),
      // Processed today
      prisma.payout.count({
        where: {
          status: 'PROCESSED',
          processed_at: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      })
    ])

    const metrics = {
      pending_payouts: pendingPayouts,
      total_payouts: totalPayouts,
      total_amount: totalAmount._sum.amount || 0,
      processed_today: processedToday
    }

    return NextResponse.json({
      success: true,
      metrics
    })

  } catch (error) {
    console.error("Error fetching settlement metrics:", error)
    return NextResponse.json(
      { error: "Failed to fetch settlement metrics" },
      { status: 500 }
    )
  }
}
