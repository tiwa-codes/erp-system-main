import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { getClientOwnership } from "@/lib/client-account"
import { checkPermission } from "@/lib/permissions"

/**
 * GET /api/clients-plans/:id
 * Admin/Client: Get specific client plan details
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params

    const clientPlan = await prisma.clientPlan.findUnique({
      where: { id },
      include: {
        services: {
          include: {
            service_type: true,
          },
        },
        organization: true,
        principal_account: {
          include: {
            user: {
              select: {
                first_name: true,
                last_name: true,
                email: true,
              },
            },
          },
        },
        client_account: {
          include: {
            user: {
              select: {
                first_name: true,
                last_name: true,
                email: true,
              },
            },
            organization: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        reviewed_by: {
          select: {
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        approved_by: {
          select: {
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        rejected_by: {
          select: {
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        invoice: true,
      },
    })

    if (!clientPlan) {
      return NextResponse.json(
        { error: "Client plan not found" },
        { status: 404 }
      )
    }

    // Check access: clients can only see their own plans, authorized staff can see all
    const canViewAll = await checkPermission(session.user.role as any, "settings", "view")
    const ownership = await getClientOwnership(session.user.id)
    const ownsViaPrincipal = Boolean(ownership.principal?.id && ownership.principal.id === clientPlan.principal_account_id)
    const ownsViaClientAccount = Boolean(
      ownership.clientAccount?.id && ownership.clientAccount.id === clientPlan.client_account_id
    )

    if (!canViewAll && !ownsViaPrincipal && !ownsViaClientAccount) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(
      { data: clientPlan },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching client plan:", error)
    return NextResponse.json(
      { error: "Failed to fetch client plan" },
      { status: 500 }
    )
  }
}
