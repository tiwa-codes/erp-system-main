import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

/**
 * GET /api/clients-plans/my-plans
 * Mobile app: Get authenticated user's client plans (draft, pending, approved, rejected)
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the principal account for this user
    const principalAccount = await prisma.principalAccount.findUnique({
      where: { user_id: session.user.id },
      include: { client_plans: true },
    })

    if (!principalAccount) {
      return NextResponse.json(
        { error: "Principal account not found" },
        { status: 404 }
      )
    }

    // Get all client plans for this principal
    const clientPlans = await prisma.clientPlan.findMany({
      where: {
        principal_account_id: principalAccount.id,
      },
      include: {
        services: {
          include: {
            service_type: true,
          },
        },
        invoice: true,
        organization: true,
      },
      orderBy: { created_at: "desc" },
    })

    return NextResponse.json(
      {
        data: clientPlans,
        total: clientPlans.length,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching client plans:", error)
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    )
  }
}
