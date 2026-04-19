import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

/**
 * POST /api/clients-plans/submit
 * Mobile app: Submit draft plan to admin (changes status from DRAFT to PENDING)
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { planId } = await req.json()

    // Get the principal account for this user
    const principalAccount = await prisma.principalAccount.findUnique({
      where: { user_id: session.user.id },
    })

    if (!principalAccount) {
      return NextResponse.json(
        { error: "Principal account not found" },
        { status: 404 }
      )
    }

    // Verify the plan belongs to this principal
    const clientPlan = await prisma.clientPlan.findFirst({
      where: {
        id: planId,
        principal_account_id: principalAccount.id,
        status: "DRAFT",
      },
      include: { services: true },
    })

    if (!clientPlan) {
      return NextResponse.json(
        { error: "Plan not found or already submitted" },
        { status: 404 }
      )
    }

    // Validate that the plan has at least one service
    if (!clientPlan.services || clientPlan.services.length === 0) {
      return NextResponse.json(
        { error: "Plan must have at least one service" },
        { status: 400 }
      )
    }

    // Update plan status to PENDING
    const updatedPlan = await prisma.clientPlan.update({
      where: { id: clientPlan.id },
      data: {
        status: "PENDING",
        submitted_at: new Date(),
        notification_read: false,
      },
      include: {
        services: true,
        organization: true,
        principal_account: true,
      },
    })

    return NextResponse.json(
      {
        data: updatedPlan,
        message: "Plan submitted successfully. Awaiting admin review.",
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error submitting plan:", error)
    return NextResponse.json(
      { error: "Failed to submit plan" },
      { status: 500 }
    )
  }
}
