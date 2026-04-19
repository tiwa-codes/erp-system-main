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

    // Get metrics from database
    const [
      totalReports,
      totalEnrollees,
      totalClaims,
      totalDownloads,
      previousMonthReports,
      previousMonthEnrollees,
      previousMonthClaims,
      previousMonthDownloads
    ] = await Promise.all([
      // Current month metrics
      prisma.report.count({
        where: {
          generated_at: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      
      prisma.principalAccount.count(),
      
      prisma.claim.count(),
      
      prisma.auditLog.count({
        where: {
          action: "REPORT_DOWNLOADED",
          created_at: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      
      // Previous month metrics for trend calculation
      prisma.report.count({
        where: {
          generated_at: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
            lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      
      prisma.principalAccount.count({
        where: {
          created_at: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
            lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      
      prisma.claim.count({
        where: {
          created_at: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
            lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      
      prisma.auditLog.count({
        where: {
          action: "REPORT_DOWNLOADED",
          created_at: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
            lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      })
    ])

    // Calculate trends
    const reportsTrend = previousMonthReports > 0 
      ? Math.round(((totalReports - previousMonthReports) / previousMonthReports) * 100)
      : totalReports > 0 ? 100 : 0

    const enrolleesTrend = previousMonthEnrollees > 0 
      ? Math.round(((totalEnrollees - previousMonthEnrollees) / previousMonthEnrollees) * 100)
      : totalEnrollees > 0 ? 100 : 0

    const claimsTrend = previousMonthClaims > 0 
      ? Math.round(((totalClaims - previousMonthClaims) / previousMonthClaims) * 100)
      : totalClaims > 0 ? 100 : 0

    const downloadsTrend = previousMonthDownloads > 0 
      ? Math.round(((totalDownloads - previousMonthDownloads) / previousMonthDownloads) * 100)
      : totalDownloads > 0 ? 100 : 0

    const metrics = {
      total_reports: totalReports,
      total_enrollees: totalEnrollees,
      total_claims: totalClaims,
      total_downloads: totalDownloads,
      reports_trend: reportsTrend,
      enrollees_trend: enrolleesTrend,
      claims_trend: claimsTrend,
      downloads_trend: downloadsTrend
    }

    return NextResponse.json({
      success: true,
      metrics
    })

  } catch (error) {
    console.error("Error fetching reports dashboard metrics:", error)
    return NextResponse.json(
      { error: "Failed to fetch reports dashboard metrics" },
      { status: 500 }
    )
  }
}
