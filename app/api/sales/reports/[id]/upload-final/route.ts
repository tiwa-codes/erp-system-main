import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { SalesReportStatus } from "@prisma/client"
import { z } from "zod"

const uploadFinalSchema = z.object({
  final_copy_url: z.string().url("Valid file URL is required"),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canUpload = await checkPermission(session.user.role as any, "sales", "upload")
    const canApprove = await checkPermission(session.user.role as any, "sales", "approve")
    
    if (!canUpload && !canApprove) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const report = await prisma.salesReport.findUnique({
      where: { id: params.id },
    })

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    if (report.status !== SalesReportStatus.APPROVED) {
      return NextResponse.json(
        {
          success: false,
          error: "Only approved reports can have final copy uploaded",
        },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = uploadFinalSchema.parse(body)

    const updatedReport = await prisma.salesReport.update({
      where: { id: params.id },
      data: {
        status: SalesReportStatus.FINAL_COPY_UPLOADED,
        final_copy_url: validatedData.final_copy_url,
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
        action: "SALES_REPORT_UPLOAD_FINAL",
        resource: "sales_report",
        resource_id: updatedReport.id,
        old_values: {
          status: report.status,
          final_copy_url: report.final_copy_url,
        },
        new_values: {
          status: updatedReport.status,
          final_copy_url: updatedReport.final_copy_url,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedReport,
    })
  } catch (error) {
    console.error("Error uploading final copy:", error)
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
        error: error instanceof Error ? error.message : "Failed to upload final copy",
      },
      { status: 500 }
    )
  }
}

