import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"
import { LegalDocumentStatus, LegalDocumentType, ComplianceCertificateType } from "@prisma/client"

const documentUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  file_url: z.string().url().optional(),
  compliance_certificate_type: z.nativeEnum(ComplianceCertificateType).optional(),
  expiry_date: z.string().datetime().optional().or(z.literal("")),
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

    const canView = await checkPermission(session.user.role as any, "legal", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const document = await prisma.legalDocument.findUnique({
      where: { id: params.id },
      include: {
        created_by: {
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
        signatures: {
          include: {
            signer: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
              },
            },
          },
          orderBy: { signed_at: "desc" },
        },
      },
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Sales team can only view approved documents
    const userRole = session.user.role as any
    const isSales = userRole === "SALES" || (typeof userRole === "object" && userRole?.name === "SALES")
    if (isSales && document.status !== LegalDocumentStatus.APPROVED) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      data: document,
    })
  } catch (error) {
    console.error("Error fetching legal document:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch legal document",
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

    const canEdit = await checkPermission(session.user.role as any, "legal", "edit")
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const document = await prisma.legalDocument.findUnique({
      where: { id: params.id },
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Only DRAFT documents can be edited
    if (document.status !== LegalDocumentStatus.DRAFT) {
      return NextResponse.json(
        {
          success: false,
          error: "Only draft documents can be edited",
        },
        { status: 400 }
      )
    }

    // Only creator or users with edit permission can edit
    if (document.created_by_id !== session.user.id) {
      const hasEditPermission = await checkPermission(session.user.role as any, "legal", "edit")
      if (!hasEditPermission) {
        return NextResponse.json(
          {
            success: false,
            error: "You can only edit your own documents",
          },
          { status: 403 }
        )
      }
    }

    const body = await request.json()
    const validatedData = documentUpdateSchema.parse(body)

    const updateData: any = {}
    if (validatedData.title !== undefined) updateData.title = validatedData.title
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.file_url !== undefined) updateData.file_url = validatedData.file_url
    if (validatedData.compliance_certificate_type !== undefined)
      updateData.compliance_certificate_type = validatedData.compliance_certificate_type
    if (validatedData.expiry_date !== undefined) {
      updateData.expiry_date = validatedData.expiry_date ? new Date(validatedData.expiry_date) : null
    }

    const updatedDocument = await prisma.legalDocument.update({
      where: { id: params.id },
      data: updateData,
      include: {
        created_by: {
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
        action: "LEGAL_DOCUMENT_UPDATE",
        resource: "legal_document",
        resource_id: updatedDocument.id,
        old_values: document,
        new_values: updatedDocument,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedDocument,
    })
  } catch (error) {
    console.error("Error updating legal document:", error)
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
        error: error instanceof Error ? error.message : "Failed to update legal document",
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

    const canDelete = await checkPermission(session.user.role as any, "legal", "delete")
    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const document = await prisma.legalDocument.findUnique({
      where: { id: params.id },
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Only DRAFT documents can be deleted
    if (document.status !== LegalDocumentStatus.DRAFT) {
      return NextResponse.json(
        {
          success: false,
          error: "Only draft documents can be deleted",
        },
        { status: 400 }
      )
    }

    await prisma.legalDocument.delete({
      where: { id: params.id },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "LEGAL_DOCUMENT_DELETE",
        resource: "legal_document",
        resource_id: document.id,
        old_values: document,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting legal document:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete legal document",
      },
      { status: 500 }
    )
  }
}

