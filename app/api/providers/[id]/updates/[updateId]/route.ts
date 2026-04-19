import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const updateStatusSchema = z.object({
  status: z.enum(["PENDING", "APPROVED"]),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; updateId: string } }
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

    const update = await prisma.providerUpdate.updateMany({
      where: {
        id: params.updateId,
        provider_id: params.id,
      },
      data: {
        status: parsed.status,
      },
    })

    if (update.count === 0) {
      return NextResponse.json(
        { success: false, error: "Update not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; updateId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canDelete = await checkPermission(session.user.role as any, "underwriting", "delete")
    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.providerUpdate.deleteMany({
      where: {
        id: params.updateId,
        provider_id: params.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting provider update:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete provider update" },
      { status: 500 }
    )
  }
}

