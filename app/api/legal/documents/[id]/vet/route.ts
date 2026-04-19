import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { LegalDocumentStatus } from "@prisma/client"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canVet = await checkPermission(session.user.role as any, "legal", "vet")
    if (!canVet) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const document = await prisma.legalDocument.findUnique({
      where: { id: params.id },
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    if (document.status !== LegalDocumentStatus.DRAFT) {
      return NextResponse.json(
        {
          success: false,
          error: "Only draft documents can be vetted",
        },
        { status: 400 }
      )
    }

    const updatedDocument = await prisma.legalDocument.update({
      where: { id: params.id },
      data: {
        status: LegalDocumentStatus.VETTED,
        vetted_by_id: session.user.id,
        vetted_at: new Date(),
      },
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
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "LEGAL_DOCUMENT_VET",
        resource: "legal_document",
        resource_id: updatedDocument.id,
        old_values: {
          status: document.status,
        },
        new_values: {
          status: updatedDocument.status,
          vetted_by_id: updatedDocument.vetted_by_id,
          vetted_at: updatedDocument.vetted_at,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedDocument,
    })
  } catch (error) {
    console.error("Error vetting legal document:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to vet legal document",
      },
      { status: 500 }
    )
  }
}

