import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"
import { Prisma, SalesSubmodule, ReportType, SalesReportStatus } from "@prisma/client"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

const reportCreateSchema = z.object({
  submodule: z.nativeEnum(SalesSubmodule),
  region_id: z.string().min(1, "Region is required"),
  branch_id: z.string().min(1, "Branch is required"),
  report_type: z.nativeEnum(ReportType),
  report_period: z.string().datetime(),
  report_period_end: z.string().datetime().optional(),
  title: z.string().min(1, "Title is required"),
  sales_amount: z.number().positive("Sales amount must be positive"),
  target_amount: z.number().positive("Target amount must be positive"),
  state: z.string().min(1, "State is required"),
  notes: z.string().optional(),
})

function buildReportId(): string {
  const ts = Date.now().toString()
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")
  return `${ts}${rand}`
}

function isReportIdConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (error.code !== "P2002") return false
  const target = (error.meta as any)?.target
  if (Array.isArray(target)) return target.includes("report_id")
  return String(target || "").includes("report_id")
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "sales", "view")
    const canViewAll = await checkPermission(session.user.role as any, "sales", "view_all")
    
    if (!canView && !canViewAll) {
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

    // If user can only view (not view_all), filter by their submodule
    // This would need to be determined based on user's role/department
    // For now, we'll allow filtering by submodule parameter
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
    console.error("Error fetching sales reports:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch sales reports",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [canAdd, canSubmit] = await Promise.all([
      checkPermission(session.user.role as any, "sales", "add"),
      checkPermission(session.user.role as any, "sales", "submit"),
    ])
    const normalizedRole = String(session.user.role || "")
      .replace(/\s+/g, "_")
      .toUpperCase()
    const salesFamilyRoles = new Set([
      "SALES",
      "TECHNICAL_ASSISTANT_SALES",
      "HEAD_OF_AGENCY",
      "SALES_OPERATIONS_MANAGER",
    ])
    const isSalesFamilyRole = salesFamilyRoles.has(normalizedRole)

    if (!canAdd && !canSubmit && !isSalesFamilyRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = reportCreateSchema.parse(body)

    const branch = await prisma.salesBranch.findUnique({
      where: { id: validatedData.branch_id },
      select: {
        id: true,
        region_id: true,
        state: true,
        is_active: true,
      },
    })

    if (!branch || !branch.is_active) {
      return NextResponse.json(
        {
          success: false,
          error: "Selected branch is invalid",
        },
        { status: 400 }
      )
    }

    if (branch.region_id !== validatedData.region_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Selected branch does not belong to selected region",
        },
        { status: 400 }
      )
    }

    // Calculate achievement percentage
    const achievement = (validatedData.sales_amount / validatedData.target_amount) * 100

    let report: any = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidateReportId = buildReportId()
      try {
        report = await prisma.salesReport.create({
          data: {
            report_id: candidateReportId,
            submodule: validatedData.submodule,
            region_id: validatedData.region_id,
            branch_id: validatedData.branch_id,
            report_type: validatedData.report_type,
            report_period: new Date(validatedData.report_period),
            report_period_end: validatedData.report_period_end
              ? new Date(validatedData.report_period_end)
              : null,
            title: validatedData.title,
            sales_amount: validatedData.sales_amount,
            target_amount: validatedData.target_amount,
            state: branch.state || validatedData.state,
            achievement: achievement,
            notes: validatedData.notes,
            status: SalesReportStatus.DRAFT,
          },
          include: {
            submitted_by: {
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
      })
        break
      } catch (createError) {
        if (isReportIdConflict(createError) && attempt < 4) {
          continue
        }
        throw createError
      }
    }

    if (!report) {
      return NextResponse.json(
        {
          success: false,
          error: "Unable to generate unique report ID. Please try again.",
        },
        { status: 500 }
      )
    }

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "SALES_REPORT_CREATE",
        resource: "sales_report",
        resource_id: report.id,
        new_values: {
          report_id: report.report_id,
          submodule: report.submodule,
          region_id: report.region_id,
          branch_id: report.branch_id,
          report_type: report.report_type,
          state: report.state,
          title: report.title,
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: report,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating sales report:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create sales report",
      },
      { status: 500 }
    )
  }
}
