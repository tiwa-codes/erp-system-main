import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params

    // Get the tariff plan to find provider_id
    const tariffPlan = await prisma.tariffPlan.findUnique({
      where: { id },
      select: {
        provider_id: true,
      },
    })

    if (!tariffPlan) {
      return NextResponse.json(
        { error: "Tariff plan not found" },
        { status: 404 }
      )
    }

    // Check permissions
    const hasPermission = await checkPermission(session.user.role as any, "provider", "manage_tariff_plan")
    const isProviderUser = session.user.provider_id === tariffPlan.provider_id

    if (!hasPermission && !isProviderUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get all tariff plans for this provider (version history)
    const history = await prisma.tariffPlan.findMany({
      where: {
        provider_id: tariffPlan.provider_id,
      },
      include: {
        approved_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        _count: {
          select: {
            tariff_plan_services: true,
          },
        },
      },
      orderBy: {
        version: "desc",
      },
    })

    return NextResponse.json({
      success: true,
      history,
    })
  } catch (error) {
    console.error("Error fetching tariff plan history:", error)
    return NextResponse.json(
      { error: "Failed to fetch tariff plan history" },
      { status: 500 }
    )
  }
}

