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

    switch (timeRange) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case "1y":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    // Get chart data
    const [
      claimsOverTime,
      payoutOverTime,
      enrolleesByPlan,
      providersByStatus
    ] = await Promise.all([
      // Claims over time (daily aggregation)
      prisma.claim.groupBy({
        by: ['created_at'],
        where: {
          created_at: { gte: startDate }
        },
        _count: {
          id: true
        },
        orderBy: {
          created_at: 'asc'
        }
      }),
      
      // Payout over time (daily aggregation)
      prisma.financialTransaction.groupBy({
        by: ['created_at'],
        where: {
          transaction_type: "CLAIM_PAYOUT",
          status: "PROCESSED",
          created_at: { gte: startDate }
        },
        _sum: {
          amount: true
        },
        orderBy: {
          created_at: 'asc'
        }
      }),
      
      // Enrollees by plan
      prisma.principalAccount.groupBy({
        by: ['plan_id'],
        where: {
          created_at: { gte: startDate }
        },
        _count: {
          id: true
        }
      }),
      
      // Providers by status
      prisma.provider.groupBy({
        by: ['status'],
        where: {
          created_at: { gte: startDate }
        },
        _count: {
          id: true
        }
      })
    ])

    // Format chart data
    const charts = {
      claims_over_time: claimsOverTime.map(item => ({
        date: item.created_at.toISOString().split('T')[0],
        count: item._count.id
      })),
      
      payout_over_time: payoutOverTime.map(item => ({
        date: item.created_at.toISOString().split('T')[0],
        amount: Number(item._sum.amount || 0)
      })),
      
      enrollees_by_plan: enrolleesByPlan.map(item => ({
        plan_id: item.plan_id,
        count: item._count.id
      })),
      
      providers_by_status: providersByStatus.map(item => ({
        status: item.status,
        count: item._count.id
      }))
    }

    return NextResponse.json({
      success: true,
      charts
    })

  } catch (error) {
    console.error("Error fetching analytics charts:", error)
    return NextResponse.json(
      { error: "Failed to fetch analytics charts" },
      { status: 500 }
    )
  }
}
