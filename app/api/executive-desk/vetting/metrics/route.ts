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

    // Check if user has executive approval permissions
    const hasPermission = await checkPermission(session.user.role as any, "executive-desk", "approve")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Get metrics for executive desk vetting
    const [
      totalPending,
      totalVetted,
      totalFlagged,
      totalAmount,
      approvedAmount,
      rejectedAmount
    ] = await Promise.all([
      prisma.claim.count({
        where: { status: 'AUDIT_COMPLETED' }
      }),
      prisma.claim.count({
        where: { status: 'APPROVED' }
      }),
      prisma.claim.count({
        where: { 
          status: 'AUDIT_COMPLETED',
          fraud_alerts: { some: { status: 'OPEN' } }
        }
      }),
      prisma.claim.aggregate({
        where: { status: { in: ['AUDIT_COMPLETED', 'APPROVED', 'REJECTED'] } },
        _sum: { amount: true }
      }),
      prisma.claim.aggregate({
        where: { status: 'APPROVED' },
        _sum: { amount: true }
      }),
      prisma.claim.aggregate({
        where: { status: 'REJECTED' },
        _sum: { amount: true }
      })
    ])

    const metrics = {
      total_pending: totalPending,
      total_vetted: totalVetted,
      total_flagged: totalFlagged,
      avg_processing_time: 0, // Calculate based on your business logic
      total_amount: totalAmount._sum.amount || 0,
      approved_amount: approvedAmount._sum.amount || 0,
      rejected_amount: rejectedAmount._sum.amount || 0,
      net_amount: (approvedAmount._sum.amount || 0) - (rejectedAmount._sum.amount || 0)
    }

    return NextResponse.json({
      success: true,
      metrics
    })

  } catch (error) {
    console.error("Error fetching executive desk vetting metrics:", error)
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    )
  }
}
