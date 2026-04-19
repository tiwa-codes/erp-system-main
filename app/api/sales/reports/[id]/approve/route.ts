import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { SalesReportStatus } from "@prisma/client"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canApprove = await checkPermission(session.user.role as any, "sales", "approve")
    if (!canApprove) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const report = await prisma.salesReport.findUnique({
      where: { id: params.id },
    })

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    if (report.status !== SalesReportStatus.VETTED) {
      return NextResponse.json(
        {
          success: false,
          error: "Only vetted reports can be approved",
        },
        { status: 400 }
      )
    }

    const updatedReport = await prisma.salesReport.update({
      where: { id: params.id },
      data: {
        status: SalesReportStatus.APPROVED,
        approved_by_id: session.user.id,
        approved_at: new Date(),
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
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "SALES_REPORT_APPROVE",
        resource: "sales_report",
        resource_id: updatedReport.id,
        old_values: {
          status: report.status,
        },
        new_values: {
          status: updatedReport.status,
          approved_by_id: updatedReport.approved_by_id,
          approved_at: updatedReport.approved_at,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedReport,
    })
  } catch (error) {
    console.error("Error approving sales report:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to approve sales report",
      },
      { status: 500 }
    )
  }
}

