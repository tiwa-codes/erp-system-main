import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { SalesSubmodule, ReportType, SalesReportStatus } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canViewAll = await checkPermission(session.user.role as any, "sales", "view_all")
    if (!canViewAll) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")

    const where: any = {}

    if (startDate) {
      where.report_period = { gte: new Date(startDate) }
    }

    if (endDate) {
      where.report_period = { ...where.report_period, lte: new Date(endDate) }
    }

    // Get all reports for aggregation
    const allReports = await prisma.salesReport.findMany({
      where,
      select: {
        submodule: true,
        report_type: true,
        status: true,
        sales_amount: true,
        target_amount: true,
        achievement: true,
      },
    })

    // Calculate statistics by submodule
    const submoduleStats: Record<string, any> = {}
    for (const submodule of Object.values(SalesSubmodule)) {
      const submoduleReports = allReports.filter((r) => r.submodule === submodule)
      const totalSales = submoduleReports.reduce((sum, r) => sum + Number(r.sales_amount), 0)
      const totalTarget = submoduleReports.reduce((sum, r) => sum + Number(r.target_amount), 0)
      const avgAchievement =
        submoduleReports.length > 0
          ? submoduleReports.reduce((sum, r) => sum + Number(r.achievement), 0) / submoduleReports.length
          : 0

      submoduleStats[submodule] = {
        total_reports: submoduleReports.length,
        total_sales: totalSales,
        total_target: totalTarget,
        average_achievement: avgAchievement,
        by_status: {
          DRAFT: submoduleReports.filter((r) => r.status === SalesReportStatus.DRAFT).length,
          SUBMITTED: submoduleReports.filter((r) => r.status === SalesReportStatus.SUBMITTED).length,
          VETTED: submoduleReports.filter((r) => r.status === SalesReportStatus.VETTED).length,
          APPROVED: submoduleReports.filter((r) => r.status === SalesReportStatus.APPROVED).length,
          FINAL_COPY_UPLOADED: submoduleReports.filter((r) => r.status === SalesReportStatus.FINAL_COPY_UPLOADED)
            .length,
        },
        by_report_type: {
          DAILY: submoduleReports.filter((r) => r.report_type === ReportType.DAILY).length,
          WEEKLY: submoduleReports.filter((r) => r.report_type === ReportType.WEEKLY).length,
          MONTHLY: submoduleReports.filter((r) => r.report_type === ReportType.MONTHLY).length,
          QUARTERLY: submoduleReports.filter((r) => r.report_type === ReportType.QUARTERLY).length,
          HALF_YEARLY: submoduleReports.filter((r) => r.report_type === ReportType.HALF_YEARLY).length,
          YEARLY: submoduleReports.filter((r) => r.report_type === ReportType.YEARLY).length,
        },
      }
    }

    // Overall statistics
    const totalReports = allReports.length
    const totalSales = allReports.reduce((sum, r) => sum + Number(r.sales_amount), 0)
    const totalTarget = allReports.reduce((sum, r) => sum + Number(r.target_amount), 0)
    const overallAchievement = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0

    return NextResponse.json({
      success: true,
      data: {
        overall: {
          total_reports: totalReports,
          total_sales: totalSales,
          total_target: totalTarget,
          overall_achievement: overallAchievement,
          by_status: {
            DRAFT: allReports.filter((r) => r.status === SalesReportStatus.DRAFT).length,
            SUBMITTED: allReports.filter((r) => r.status === SalesReportStatus.SUBMITTED).length,
            VETTED: allReports.filter((r) => r.status === SalesReportStatus.VETTED).length,
            APPROVED: allReports.filter((r) => r.status === SalesReportStatus.APPROVED).length,
            FINAL_COPY_UPLOADED: allReports.filter((r) => r.status === SalesReportStatus.FINAL_COPY_UPLOADED)
              .length,
          },
        },
        by_submodule: submoduleStats,
      },
    })
  } catch (error) {
    console.error("Error fetching consolidated dashboard:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch dashboard statistics",
      },
      { status: 500 }
    )
  }
}

