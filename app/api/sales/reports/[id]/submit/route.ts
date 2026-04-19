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

    const [canSubmit, canAdd] = await Promise.all([
      checkPermission(session.user.role as any, "sales", "submit"),
      checkPermission(session.user.role as any, "sales", "add"),
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

    if (!canSubmit && !canAdd && !isSalesFamilyRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const report = await prisma.salesReport.findUnique({
      where: { id: params.id },
    })

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    if (report.status !== SalesReportStatus.DRAFT) {
      return NextResponse.json(
        {
          success: false,
          error: "Only draft reports can be submitted",
        },
        { status: 400 }
      )
    }

    const updatedReport = await prisma.salesReport.update({
      where: { id: params.id },
      data: {
        status: SalesReportStatus.SUBMITTED,
        submitted_by_id: session.user.id,
        submitted_at: new Date(),
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
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "SALES_REPORT_SUBMIT",
        resource: "sales_report",
        resource_id: updatedReport.id,
        old_values: {
          status: report.status,
        },
        new_values: {
          status: updatedReport.status,
          submitted_by_id: updatedReport.submitted_by_id,
          submitted_at: updatedReport.submitted_at,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedReport,
    })
  } catch (error) {
    console.error("Error submitting sales report:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to submit sales report",
      },
      { status: 500 }
    )
  }
}
