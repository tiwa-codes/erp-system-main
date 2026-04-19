import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { checkPermission } from "@/lib/permissions"

/**
 * PATCH /api/clients-plans/:id/reject
 * Admin: Reject client plan with reason
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
    const { rejection_reason } = await req.json()

    if (!rejection_reason || rejection_reason.trim().length === 0) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      )
    }

    // Get the plan
    const clientPlan = await prisma.clientPlan.findUnique({
      where: { id },
      include: {
        principal_account: {
          include: {
            user: true,
          },
        },
        client_account: {
          include: {
            user: true,
          },
        },
      },
    })

    if (!clientPlan) {
      return NextResponse.json(
        { error: "Client plan not found" },
        { status: 404 }
      )
    }

    if (clientPlan.status !== "PENDING" && clientPlan.status !== "REVIEW") {
      return NextResponse.json(
        { error: "Plan must be in PENDING or REVIEW status to reject" },
        { status: 400 }
      )
    }

    // Update plan to REJECTED
    const updatedPlan = await prisma.clientPlan.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejection_reason,
        rejected_at: new Date(),
        rejected_by_id: session.user.id,
        notification_read: false,
      },
      include: {
        services: true,
        principal_account: true,
        client_account: {
          include: {
            user: true,
            organization: true,
          },
        },
        organization: true,
        rejected_by: {
          select: {
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    })

    // TODO: Send rejection email to client
    // sendRejectionEmail(clientPlan.principal_account.user?.email, rejection_reason)

    return NextResponse.json(
      {
        data: updatedPlan,
        message: "Plan rejected successfully",
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error rejecting plan:", error)
    return NextResponse.json(
      { error: "Failed to reject plan" },
      { status: 500 }
    )
  }
}
