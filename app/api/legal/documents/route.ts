import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"
import { LegalDocumentType, LegalDocumentStatus, ComplianceCertificateType } from "@prisma/client"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

const documentCreateSchema = z.object({
  document_type: z.nativeEnum(LegalDocumentType),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  file_url: z.string().url("Valid file URL is required"),
  compliance_certificate_type: z.nativeEnum(ComplianceCertificateType).optional(),
  expiry_date: z.string().datetime().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "legal", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim()
    const documentType = searchParams.get("document_type") as LegalDocumentType | null
    const status = searchParams.get("status") as LegalDocumentStatus | null
    const page = parseInt(searchParams.get("page") || "1")
    const limit = Math.min(parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT)), MAX_LIMIT)
    const skip = (page - 1) * limit

    const where: any = {}

    // Sales team can only see approved documents
    const userRole = session.user.role as any
    if (userRole === "SALES" || (typeof userRole === "object" && userRole?.name === "SALES")) {
      where.status = LegalDocumentStatus.APPROVED
    } else {
      // Other users can see documents based on their permissions
      // Staff can see their own documents in any status
      // Legal/Admin can see all documents
      if (status) {
        where.status = status
      }
    }

    if (documentType) {
      where.document_type = documentType
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { document_id: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    const [documents, total] = await Promise.all([
      prisma.legalDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
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
      }),
      prisma.legalDocument.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        documents,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error("Error fetching legal documents:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch legal documents",
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

    const canAdd = await checkPermission(session.user.role as any, "legal", "add")
    if (!canAdd) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = documentCreateSchema.parse(body)

    // Generate unique document_id
    const lastDocument = await prisma.legalDocument.findFirst({
      orderBy: { document_id: "desc" },
    })

    const nextDocumentId = lastDocument
      ? (parseInt(lastDocument.document_id) + 1).toString()
      : "1"

    const document = await prisma.legalDocument.create({
      data: {
        document_id: nextDocumentId,
        document_type: validatedData.document_type,
        title: validatedData.title,
        description: validatedData.description,
        file_url: validatedData.file_url,
        compliance_certificate_type: validatedData.compliance_certificate_type,
        expiry_date: validatedData.expiry_date ? new Date(validatedData.expiry_date) : null,
        status: LegalDocumentStatus.DRAFT,
        created_by_id: session.user.id,
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
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "LEGAL_DOCUMENT_CREATE",
        resource: "legal_document",
        resource_id: document.id,
        new_values: {
          document_id: document.document_id,
          document_type: document.document_type,
          title: document.title,
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: document,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating legal document:", error)
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
        error: error instanceof Error ? error.message : "Failed to create legal document",
      },
      { status: 500 }
    )
  }
}

