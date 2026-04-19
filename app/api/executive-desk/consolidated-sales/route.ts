import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { SalesSubmodule, ReportType, SalesReportStatus } from "@prisma/client"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

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
    const search = searchParams.get("search")?.trim()
    const submodule = searchParams.get("submodule") as SalesSubmodule | null
    const reportType = searchParams.get("report_type") as ReportType | null
    const status = searchParams.get("status") as SalesReportStatus | null
    const regionId = searchParams.get("region_id")
    const branchId = searchParams.get("branch_id")
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = Math.min(parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT)), MAX_LIMIT)
    const skip = (page - 1) * limit

    const where: any = {}

    if (submodule) {
      where.submodule = submodule
    }

    if (reportType) {
      where.report_type = reportType
    }

    if (status) {
      where.status = status
    }

    if (regionId) {
      where.region_id = regionId
    }

    if (branchId) {
      where.branch_id = branchId
    }

    if (startDate) {
      where.report_period = { gte: new Date(startDate) }
    }

    if (endDate) {
      where.report_period = { ...where.report_period, lte: new Date(endDate) }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { report_id: { contains: search, mode: "insensitive" } },
        { state: { contains: search, mode: "insensitive" } },
        { region: { name: { contains: search, mode: "insensitive" } } },
        { branch: { name: { contains: search, mode: "insensitive" } } },
        { notes: { contains: search, mode: "insensitive" } },
      ]
    }

    const [reports, total] = await Promise.all([
      prisma.salesReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { report_period: "desc" },
        include: {
          submitted_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          vetted_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          approved_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          region: {
            select: {
              id: true,
              name: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              state: true,
            },
          },
        },
      }),
      prisma.salesReport.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        reports,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error("Error fetching consolidated sales reports:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch consolidated reports",
      },
      { status: 500 }
    )
  }
}
