import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { coverageSchema } from "../schema"
import { z } from "zod"

const updateSchema = coverageSchema.partial()

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
    const parsed = updateSchema.parse(body)

    const rule = await prisma.coverageRule.update({
      where: { id: params.id },
      data: { ...parsed },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            plan_type: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, rule })
  } catch (error) {
    console.error("Error updating coverage rule:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: "Failed to update coverage rule" },
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
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canDelete = await checkPermission(session.user.role as any, "underwriting", "delete")
    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.coverageRule.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting coverage rule:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete coverage rule" },
      { status: 500 }
    )
  }
}

