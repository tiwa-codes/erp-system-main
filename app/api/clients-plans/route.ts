import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { checkPermission } from "@/lib/permissions"

/**
 * GET /api/clients-plans
 * Admin: List all client plans with filtering by status
 * Query params: status (PENDING, APPROVED, REJECTED), organization_id (optional)
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "settings", "view")
    if (!canView) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(req.url)
    const status = url.searchParams.get("status") || "PENDING"
    const organizationId = url.searchParams.get("organization_id")
    const page = parseInt(url.searchParams.get("page") || "1")
    const limit = parseInt(url.searchParams.get("limit") || "10")
    const offset = (page - 1) * limit

    // Build where clause
    const where: any = {}

    if (status) {
      where.status = status.toUpperCase()
    }

    if (organizationId) {
      where.organization_id = organizationId
    }

    // Get total count
    const total = await prisma.clientPlan.count({ where })

    // Get plans with pagination
    const clientPlans = await prisma.clientPlan.findMany({
      where,
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
      orderBy: {
        submitted_at: "desc",
      },
      skip: offset,
      take: limit,
    })

    return NextResponse.json(
      {
        data: clientPlans,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching client plans:", error)
    return NextResponse.json(
      { error: "Failed to fetch client plans" },
      { status: 500 }
    )
  }
}
