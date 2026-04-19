import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { ProviderStatus } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has provider view permissions
    const canView = await checkPermission(session.user.role as any, "providers", "view")
    if (!canView) {
      return NextResponse.json({ error: "Insufficient permissions to view provider metrics" }, { status: 403 })
    }

    // Get today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get yesterday's date range
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayEnd = new Date(yesterday)
    yesterdayEnd.setDate(yesterdayEnd.getDate() + 1)

    // Calculate metrics
    const [
      totalPending,
      totalApprovedToday,
      totalRejectedToday,
      totalApprovedYesterday,
      totalRejectedYesterday
    ] = await Promise.all([
      // Total pending approval
      prisma.provider.count({
        where: {
          status: ProviderStatus.PENDING_APPROVAL
        }
      }),

      // Total approved today (providers that became active today)
      prisma.provider.count({
        where: {
          status: ProviderStatus.ACTIVE,
          updated_at: {
            gte: today,
            lt: tomorrow
          }
        }
      }),

      // Total rejected today (providers that became inactive today)
      prisma.provider.count({
        where: {
          status: ProviderStatus.INACTIVE,
          updated_at: {
            gte: today,
            lt: tomorrow
          }
        }
      }),

      // Total approved yesterday (providers that became active yesterday)
      prisma.provider.count({
        where: {
          status: ProviderStatus.ACTIVE,
          updated_at: {
            gte: yesterday,
            lt: yesterdayEnd
          }
        }
      }),

      // Total rejected yesterday (providers that became inactive yesterday)
      prisma.provider.count({
        where: {
          status: ProviderStatus.INACTIVE,
          updated_at: {
            gte: yesterday,
            lt: yesterdayEnd
          }
        }
      })
    ])

    // Calculate processing time manually using updated_at as proxy for approval time
    const processedProviders = await prisma.provider.findMany({
      where: {
        status: {
          in: [ProviderStatus.ACTIVE, ProviderStatus.INACTIVE]
        }
      },
      select: {
        created_at: true,
        updated_at: true
      }
    })

    let totalProcessingTime = 0
    let processedCount = 0

    processedProviders.forEach(provider => {
      const processingTime = provider.updated_at.getTime() - provider.created_at.getTime()
      totalProcessingTime += processingTime
      processedCount++
    })

    const avgProcessingTimeHours = processedCount > 0 
      ? Math.round((totalProcessingTime / processedCount) / (1000 * 60 * 60) * 10) / 10 
      : 0

    // Calculate trends
    const approvedTrend = totalApprovedYesterday > 0 
      ? Math.round(((totalApprovedToday - totalApprovedYesterday) / totalApprovedYesterday) * 100)
      : totalApprovedToday > 0 ? 100 : 0

    const rejectedTrend = totalRejectedYesterday > 0 
      ? Math.round(((totalRejectedToday - totalRejectedYesterday) / totalRejectedYesterday) * 100)
      : totalRejectedToday > 0 ? 100 : 0

    const metrics = {
      total_pending: totalPending,
      total_approved_today: totalApprovedToday,
      total_rejected_today: totalRejectedToday,
      total_approved_yesterday: totalApprovedYesterday,
      total_rejected_yesterday: totalRejectedYesterday,
      avg_processing_time: avgProcessingTimeHours,
      approved_trend: approvedTrend,
      rejected_trend: rejectedTrend,
      processed_count: processedCount
    }

    return NextResponse.json({ metrics })

  } catch (error) {
    console.error("Error fetching provider approval metrics:", error)
    return NextResponse.json(
      { error: "Failed to fetch provider approval metrics" },
      { status: 500 }
    )
  }
}
