/**
 * POST /api/underwriting/mobile/updates/[id]/reject
 * Rejects a mobile update request.
 */
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

interface RouteParams {
  params: {
    id: string
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canReject = await checkPermission(session.user.role as any, "underwriting", "edit")
    if (!canReject) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { reason } = await req.json()

    // 1. Fetch the MobileUpdate record
    const update = await prisma.mobileUpdate.findUnique({
      where: { id: params.id },
    })

    if (!update) {
      return NextResponse.json({ error: "Update request not found" }, { status: 404 })
    }

    if (update.status !== "PENDING") {
      return NextResponse.json({ error: "Only PENDING requests can be rejected" }, { status: 400 })
    }

    // 2. Update status and add rejection metadata
    await prisma.mobileUpdate.update({
      where: { id: update.id },
      data: {
        status: "REJECTED",
        created_by_id: session.user.id,
        // We can append rejection reason to the payload or handle it in a new field if added to schema.
        // For now, we update the status.
      }
    })

    return NextResponse.json({ message: "Update request rejected" })

  } catch (error) {
    console.error("[MOBILE_UPDATE_REJECTION]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
