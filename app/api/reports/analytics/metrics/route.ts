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
    const timeRange = searchParams.get("timeRange") || "30d"

    // Calculate date range
    const now = new Date()
    let startDate: Date
    let previousStartDate: Date
    let previousEndDate: Date

    switch (timeRange) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
        previousEndDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
        previousEndDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        previousStartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
        previousEndDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case "1y":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        previousStartDate = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000)
        previousEndDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
        previousEndDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    // Get current period metrics
    const [
      totalEnrollees,
      totalClaims,
      totalPayout,
      activeProviders,
      previousEnrollees,
      previousClaims,
      previousPayout,
      previousProviders
    ] = await Promise.all([
      // Current period
      prisma.principalAccount.count({
        where: {
          created_at: { gte: startDate }
        }
      }),
      
      prisma.claim.count({
        where: {
          created_at: { gte: startDate }
        }
      }),
      
      prisma.financialTransaction.aggregate({
        where: {
          transaction_type: "CLAIM_PAYOUT",
          status: "PROCESSED",
          created_at: { gte: startDate }
        },
        _sum: {
          amount: true
        }
      }),
      
      prisma.provider.count({
        where: {
          status: "ACTIVE",
          created_at: { gte: startDate }
        }
      }),
      
      // Previous period
      prisma.principalAccount.count({
        where: {
          created_at: { 
            gte: previousStartDate,
            lt: previousEndDate
          }
        }
      }),
      
      prisma.claim.count({
        where: {
          created_at: { 
            gte: previousStartDate,
            lt: previousEndDate
          }
        }
      }),
      
      prisma.financialTransaction.aggregate({
        where: {
          transaction_type: "CLAIM_PAYOUT",
          status: "PROCESSED",
          created_at: { 
            gte: previousStartDate,
            lt: previousEndDate
          }
        },
        _sum: {
          amount: true
        }
      }),
      
      prisma.provider.count({
        where: {
          status: "ACTIVE",
          created_at: { 
            gte: previousStartDate,
            lt: previousEndDate
          }
        }
      })
    ])

    // Calculate trends
    const enrolleesTrend = previousEnrollees > 0 
      ? Math.round(((totalEnrollees - previousEnrollees) / previousEnrollees) * 100)
      : 0

    const claimsTrend = previousClaims > 0 
      ? Math.round(((totalClaims - previousClaims) / previousClaims) * 100)
      : 0

    const payoutTrend = previousPayout._sum.amount && previousPayout._sum.amount > 0
      ? Math.round(((Number(totalPayout._sum.amount || 0) - Number(previousPayout._sum.amount)) / Number(previousPayout._sum.amount)) * 100)
      : 0

    const providersTrend = previousProviders > 0 
      ? Math.round(((activeProviders - previousProviders) / previousProviders) * 100)
      : 0

    const metrics = {
      total_enrollees: totalEnrollees,
      total_claims: totalClaims,
      total_payout: Number(totalPayout._sum.amount || 0),
      active_providers: activeProviders,
      enrollees_trend: enrolleesTrend,
      claims_trend: claimsTrend,
      payout_trend: payoutTrend,
      providers_trend: providersTrend
    }

    return NextResponse.json({
      success: true,
      metrics
    })

  } catch (error) {
    console.error("Error fetching analytics metrics:", error)
    return NextResponse.json(
      { error: "Failed to fetch analytics metrics" },
      { status: 500 }
    )
  }
}
