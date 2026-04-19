import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const supportingDocumentsSchema = z.object({
  supporting_documents: z.array(z.string().url()),
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

    const body = await request.json()
    const validatedData = supportingDocumentsSchema.parse(body)

    const updatedReport = await prisma.salesReport.update({
      where: { id: params.id },
      data: {
        supporting_documents: validatedData.supporting_documents,
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
        action: "SALES_REPORT_UPDATE_SUPPORTING_DOCS",
        resource: "sales_report",
        resource_id: updatedReport.id,
        old_values: {
          supporting_documents: report.supporting_documents,
        },
        new_values: {
          supporting_documents: updatedReport.supporting_documents,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedReport,
    })
  } catch (error) {
    console.error("Error updating supporting documents:", error)
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
        error: error instanceof Error ? error.message : "Failed to update supporting documents",
      },
      { status: 500 }
    )
  }
}

