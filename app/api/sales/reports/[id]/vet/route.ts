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

    const canVet = await checkPermission(session.user.role as any, "sales", "vet")
    if (!canVet) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const report = await prisma.salesReport.findUnique({
      where: { id: params.id },
    })

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    if (report.status !== SalesReportStatus.SUBMITTED) {
      return NextResponse.json(
        {
          success: false,
          error: "Only submitted reports can be vetted",
        },
        { status: 400 }
      )
    }

    const updatedReport = await prisma.salesReport.update({
      where: { id: params.id },
      data: {
        status: SalesReportStatus.VETTED,
        vetted_by_id: session.user.id,
        vetted_at: new Date(),
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
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "SALES_REPORT_VET",
        resource: "sales_report",
        resource_id: updatedReport.id,
        old_values: {
          status: report.status,
        },
        new_values: {
          status: updatedReport.status,
          vetted_by_id: updatedReport.vetted_by_id,
          vetted_at: updatedReport.vetted_at,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedReport,
    })
  } catch (error) {
    console.error("Error vetting sales report:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to vet sales report",
      },
      { status: 500 }
    )
  }
}

