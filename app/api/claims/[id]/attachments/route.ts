import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const MAX_FILE_SIZE = 1 * 1024 * 1024 // 1 MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

type ClaimAttachment = {
  id: string
  name: string
  url: string
  type: string
  size: number
  stage: string
  uploaded_by?: string
  uploaded_at?: string
  timestamp?: Date
}

const toAttachmentArray = (value: unknown): Record<string, any>[] => {
  if (Array.isArray(value)) {
    return value.filter((item) => item && typeof item === "object") as Record<string, any>[]
  }

  if (value && typeof value === "object") {
    return [value as Record<string, any>]
  }

  return []
}

/**
 * POST /api/claims/[id]/attachments
 * Upload a file attachment for a claim (max 1 MB). Stores the URL in
 * a dedicated ClaimAttachment store keyed by stage so that downstream
 * stages (vetter2, audit, approval, finance) can read it via GET.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canVet = await checkPermission(session.user.role as any, "claims", "vet")
    if (!canVet) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const stage = (formData.get("stage") as string) || "vetter1"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File must be smaller than 1 MB" },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed. Use PDF, images, or Word documents." },
        { status: 400 }
      )
    }

    // Verify claim exists
    const claim = await prisma.claim.findUnique({
      where: { id: params.id },
      select: { id: true, claim_number: true },
    })
    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 })
    }

    // Upload to Cloudinary
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const uploadResult: any = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: `erp-claims/${claim.claim_number}`,
            resource_type: "auto",
            public_id: `${stage}_${Date.now()}_${file.name.replace(/\s+/g, "_")}`,
          },
          (error, result) => {
            if (error) reject(error)
            else resolve(result)
          }
        )
        .end(buffer)
    })

    const attachment = {
      name: file.name,
      url: uploadResult.secure_url,
      type: file.type,
      size: file.size,
      stage,
      uploaded_by: session.user.name || session.user.email,
      uploaded_at: new Date().toISOString(),
    }

    // Store in a claim-level attachment log using auditLog (no schema change needed):
    // We persist attachments in a dedicated claim field via a JSON column we update
    // We use AuditLog with action='CLAIM_ATTACHMENT_UPLOADED' so it's fully traceable
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "CLAIM_ATTACHMENT_UPLOADED",
        resource: "claim",
        resource_id: params.id,
        new_values: attachment,
      },
    })

    return NextResponse.json({ attachment }, { status: 201 })
  } catch (error) {
    console.error("[claim-attachments] POST error:", error)
    return NextResponse.json({ error: "Failed to upload attachment" }, { status: 500 })
  }
}

/**
 * GET /api/claims/[id]/attachments
 * Returns all attachments uploaded for this claim across all stages.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [logs, vettingActions] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          resource: "claim",
          resource_id: params.id,
          action: "CLAIM_ATTACHMENT_UPLOADED",
        },
        orderBy: { created_at: "asc" },
        select: {
          id: true,
          new_values: true,
          created_at: true,
          user: { select: { first_name: true, last_name: true, email: true } },
        },
      }),
      prisma.vettingAction.findMany({
        where: { claim_id: params.id },
        orderBy: { created_at: "asc" },
        select: {
          id: true,
          stage: true,
          attachments: true,
          created_at: true,
          action_by: {
            select: { first_name: true, last_name: true, email: true },
          },
        },
      }),
    ])

    const fromAuditLogs = logs.reduce<ClaimAttachment[]>((acc, log) => {
        const payload = (log.new_values || {}) as Record<string, any>
        const url = payload.url || payload.link || ""
        if (!url) return acc
        const fullName = [log.user?.first_name, log.user?.last_name].filter(Boolean).join(" ").trim()

        acc.push({
          id: log.id,
          name: payload.name || payload.file_name || "Attachment",
          url,
          type: payload.type || payload.mime_type || "application/octet-stream",
          size: Number(payload.size || 0),
          stage: payload.stage || "unknown",
          uploaded_by: payload.uploaded_by || fullName || log.user?.email || undefined,
          uploaded_at: payload.uploaded_at || log.created_at.toISOString(),
          timestamp: log.created_at,
        })

        return acc
      }, [])

    const fromVettingActions: ClaimAttachment[] = vettingActions.flatMap((action) => {
      const actionUserName = [action.action_by?.first_name, action.action_by?.last_name].filter(Boolean).join(" ").trim()
      return toAttachmentArray(action.attachments).flatMap((att, idx) => {
        const url = att.url || att.link || ""
        if (!url) return []
        return [
          {
            id: `${action.id}-${idx}`,
            name: att.name || att.file_name || `Attachment ${idx + 1}`,
            url,
            type: att.type || att.mime_type || "application/octet-stream",
            size: Number(att.size || 0),
            stage: att.stage || action.stage || "unknown",
            uploaded_by: att.uploaded_by || actionUserName || action.action_by?.email || undefined,
            uploaded_at: att.uploaded_at || action.created_at.toISOString(),
            timestamp: action.created_at,
          },
        ]
      })
    })

    const seen = new Set<string>()
    const attachments = [...fromAuditLogs, ...fromVettingActions]
      .filter((att) => {
        const key = `${att.url}|${att.name}|${att.stage}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => {
        const aTime = a.uploaded_at ? new Date(a.uploaded_at).getTime() : a.timestamp?.getTime() || 0
        const bTime = b.uploaded_at ? new Date(b.uploaded_at).getTime() : b.timestamp?.getTime() || 0
        return aTime - bTime
      })

    return NextResponse.json({ attachments })
  } catch (error) {
    console.error("[claim-attachments] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch attachments" }, { status: 500 })
  }
}
