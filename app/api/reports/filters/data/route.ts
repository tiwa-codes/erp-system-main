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
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const category = searchParams.get("category")
    const reportType = searchParams.get("reportType")

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    if (startDate) {
      where.generated_at = { gte: new Date(startDate) }
    }
    if (endDate) {
      where.generated_at = { 
        ...where.generated_at,
        lte: new Date(endDate)
      }
    }
    if (category && category !== "all") {
      where.category = category
    }
    if (reportType && reportType !== "all") {
      where.report_type = reportType
    }

    // Get real reports from database
    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { generated_at: "desc" },
        include: {
          generated_by: {
            select: {
              first_name: true,
              last_name: true
            }
          }
        }
      }),
      prisma.report.count({ where })
    ])

    // Format reports data
    const formattedReports = reports.map(report => ({
      id: report.id,
      category: report.category,
      department: report.department || "General",
      report_type: report.report_type,
      generated_date: report.generated_at.toISOString(),
      status: report.status.toLowerCase(),
      generated_by: `${report.generated_by.first_name} ${report.generated_by.last_name}`,
      file_path: report.file_path,
      error_message: report.error_message
    }))

    return NextResponse.json({
      success: true,
      reports: formattedReports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error("Error fetching report filters data:", error)
    return NextResponse.json(
      { error: "Failed to fetch report filters data" },
      { status: 500 }
    )
  }
}
