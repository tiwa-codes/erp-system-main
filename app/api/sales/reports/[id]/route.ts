import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"
import { SalesReportStatus, SalesSubmodule, ReportType } from "@prisma/client"

const reportUpdateSchema = z.object({
  region_id: z.string().min(1).optional(),
  branch_id: z.string().min(1).optional(),
  report_type: z.nativeEnum(ReportType).optional(),
  report_period: z.string().datetime().optional(),
  report_period_end: z.string().datetime().optional(),
  title: z.string().min(1).optional(),
  sales_amount: z.number().positive().optional(),
  target_amount: z.number().positive().optional(),
  state: z.string().min(1).optional(),
  notes: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const report = await prisma.salesReport.findUnique({
      where: { id: params.id },
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
    })

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: report,
    })
  } catch (error) {
    console.error("Error fetching sales report:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch sales report",
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canEdit = await checkPermission(session.user.role as any, "sales", "edit")
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const report = await prisma.salesReport.findUnique({
      where: { id: params.id },
    })

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    // Only DRAFT or SUBMITTED reports can be edited
    if (report.status !== SalesReportStatus.DRAFT && report.status !== SalesReportStatus.SUBMITTED) {
      return NextResponse.json(
        {
          success: false,
          error: "Only draft or submitted reports can be edited",
        },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = reportUpdateSchema.parse(body)

    const updateData: any = {}
    if (validatedData.region_id !== undefined) updateData.region_id = validatedData.region_id
    if (validatedData.branch_id !== undefined) updateData.branch_id = validatedData.branch_id
    if (validatedData.report_type !== undefined) updateData.report_type = validatedData.report_type
    if (validatedData.report_period !== undefined) updateData.report_period = new Date(validatedData.report_period)
    if (validatedData.report_period_end !== undefined) {
      updateData.report_period_end = validatedData.report_period_end
        ? new Date(validatedData.report_period_end)
        : null
    }
    if (validatedData.title !== undefined) updateData.title = validatedData.title
    if (validatedData.sales_amount !== undefined) updateData.sales_amount = validatedData.sales_amount
    if (validatedData.target_amount !== undefined) updateData.target_amount = validatedData.target_amount
    if (validatedData.state !== undefined) updateData.state = validatedData.state
    if (validatedData.notes !== undefined) updateData.notes = validatedData.notes

    const resolvedRegionId = validatedData.region_id ?? report.region_id ?? null
    const resolvedBranchId = validatedData.branch_id ?? report.branch_id ?? null

    if (resolvedRegionId && resolvedBranchId) {
      const branch = await prisma.salesBranch.findUnique({
        where: { id: resolvedBranchId },
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

      if (branch.region_id !== resolvedRegionId) {
        return NextResponse.json(
          {
            success: false,
            error: "Selected branch does not belong to selected region",
          },
          { status: 400 }
        )
      }

      updateData.region_id = resolvedRegionId
      updateData.branch_id = resolvedBranchId
      updateData.state = branch.state
    }

    // Recalculate achievement if sales_amount or target_amount changed
    if (validatedData.sales_amount !== undefined || validatedData.target_amount !== undefined) {
      const finalSalesAmount = validatedData.sales_amount ?? report.sales_amount
      const finalTargetAmount = validatedData.target_amount ?? report.target_amount
      updateData.achievement = (Number(finalSalesAmount) / Number(finalTargetAmount)) * 100
    }

    const updatedReport = await prisma.salesReport.update({
      where: { id: params.id },
      data: updateData,
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

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "SALES_REPORT_UPDATE",
        resource: "sales_report",
        resource_id: updatedReport.id,
        old_values: report,
        new_values: updatedReport,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedReport,
    })
  } catch (error) {
    console.error("Error updating sales report:", error)
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
        error: error instanceof Error ? error.message : "Failed to update sales report",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canDelete = await checkPermission(session.user.role as any, "sales", "delete")
    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const report = await prisma.salesReport.findUnique({
      where: { id: params.id },
    })

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    // Only DRAFT reports can be deleted
    if (report.status !== SalesReportStatus.DRAFT) {
      return NextResponse.json(
        {
          success: false,
          error: "Only draft reports can be deleted",
        },
        { status: 400 }
      )
    }

    await prisma.salesReport.delete({
      where: { id: params.id },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "SALES_REPORT_DELETE",
        resource: "sales_report",
        resource_id: report.id,
        old_values: report,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Report deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting sales report:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete sales report",
      },
      { status: 500 }
    )
  }
}
