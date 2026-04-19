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

    // Check if user has reports permissions
    const hasPermission = await checkPermission(session.user.role as any, "reports", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const department = searchParams.get("department")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // Build date filter
    const dateFilter: any = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate)
    }

    // Build where clause for claims
    const claimsWhere: any = {}
    if (Object.keys(dateFilter).length > 0) {
      claimsWhere.created_at = dateFilter
    }

    // Get metrics
    const [
      totalClaimsVetted,
      totalPayout,
      totalPendingClaims,
      totalPendingPayout,
      previousPeriodClaims,
      previousPeriodPayout
    ] = await Promise.all([
      // Total claims vetted (approved claims)
      prisma.claim.count({
        where: {
          ...claimsWhere,
          status: "APPROVED"
        }
      }),
      
      // Total payout amount
      prisma.financialTransaction.aggregate({
        where: {
          transaction_type: "CLAIM_PAYOUT",
          status: "PROCESSED",
          ...(Object.keys(dateFilter).length > 0 && { created_at: dateFilter })
        },
        _sum: {
          amount: true
        }
      }),
      
      // Total pending claims percentage
      prisma.claim.count({
        where: {
          ...claimsWhere,
          status: { in: ["SUBMITTED", "UNDER_REVIEW"] }
        }
      }),
      
      // Total pending payout count
      prisma.financialTransaction.count({
        where: {
          transaction_type: "CLAIM_PAYOUT",
          status: "PENDING",
          ...(Object.keys(dateFilter).length > 0 && { created_at: dateFilter })
        }
      }),
      
      // Previous period claims for trend calculation
      prisma.claim.count({
        where: {
          status: "APPROVED",
          created_at: {
            gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)   // 30 days ago
          }
        }
      }),
      
      // Previous period payout for trend calculation
      prisma.financialTransaction.aggregate({
        where: {
          transaction_type: "CLAIM_PAYOUT",
          status: "PROCESSED",
          created_at: {
            gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)   // 30 days ago
          }
        },
        _sum: {
          amount: true
        }
      })
    ])

    // Calculate trends
    const claimsTrend = previousPeriodClaims > 0 
      ? Math.round(((totalClaimsVetted - previousPeriodClaims) / previousPeriodClaims) * 100)
      : 0

    const payoutTrend = previousPeriodPayout._sum.amount && previousPeriodPayout._sum.amount > 0
      ? Math.round(((Number(totalPayout._sum.amount || 0) - Number(previousPeriodPayout._sum.amount)) / Number(previousPeriodPayout._sum.amount)) * 100)
      : 0

    const pendingClaimsPercentage = totalClaimsVetted > 0 
      ? Math.round((totalPendingClaims / (totalClaimsVetted + totalPendingClaims)) * 100)
      : 0

    const metrics = {
      total_claims_vetted: totalClaimsVetted,
      total_payout: Number(totalPayout._sum.amount || 0),
      total_pending_claims: pendingClaimsPercentage,
      total_pending_payout: totalPendingPayout,
      claims_trend: claimsTrend,
      payout_trend: payoutTrend,
      pending_claims_trend: -2, // Mock trend
      pending_payout_trend: 0
    }

    return NextResponse.json({
      success: true,
      metrics
    })

  } catch (error) {
    console.error("Error fetching overview metrics:", error)
    return NextResponse.json(
      { error: "Failed to fetch overview metrics" },
      { status: 500 }
    )
  }
}
