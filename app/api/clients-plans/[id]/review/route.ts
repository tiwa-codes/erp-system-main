import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { checkPermission } from "@/lib/permissions"

/**
 * PATCH /api/clients-plans/:id/review
 * Admin: Mark plan as under review
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canEdit = await checkPermission(session.user.role as any, "settings", "edit")
    if (!canEdit) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params

    const clientPlan = await prisma.clientPlan.findUnique({
      where: { id },
    })

    if (!clientPlan) {
      return NextResponse.json(
        { error: "Client plan not found" },
        { status: 404 }
      )
    }

    if (clientPlan.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only PENDING plans can be moved to REVIEW" },
        { status: 400 }
      )
    }

    const updatedPlan = await prisma.clientPlan.update({
      where: { id },
      data: {
        status: "REVIEW",
        reviewed_at: new Date(),
        reviewed_by_id: session.user.id,
      },
      include: {
        services: {
          include: {
            service_type: true,
          },
        },
        principal_account: true,
        client_account: {
          include: {
            user: true,
            organization: true,
          },
        },
        organization: true,
      },
    })

    return NextResponse.json(
      {
        data: updatedPlan,
        message: "Plan moved to review status",
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error updating plan review status:", error)
    return NextResponse.json(
      { error: "Failed to update plan status" },
      { status: 500 }
    )
  }
}
