import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const updateStatusSchema = z.object({
  status: z.enum(["PENDING", "APPROVED"]),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "underwriting", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const updates = await prisma.providerUpdate.findMany({
      where: { provider_id: params.id },
      orderBy: { created_at: "desc" },
    })

    return NextResponse.json({ success: true, updates })
  } catch (error) {
    console.error("Error fetching provider updates:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch provider updates" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canEdit = await checkPermission(session.user.role as any, "underwriting", "edit")
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateStatusSchema.parse(body)

    const update = await prisma.providerUpdate.update({
      where: { id: params.id },
      data: { status: parsed.status },
    })

    return NextResponse.json({ success: true, update })
  } catch (error) {
    console.error("Error updating provider update:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: "Failed to update provider update" },
      { status: 500 }
    )
  }
}

