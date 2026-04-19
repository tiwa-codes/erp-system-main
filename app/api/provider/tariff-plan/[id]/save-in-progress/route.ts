import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params

    if (!id || id === "null" || id === "undefined") {
      return NextResponse.json(
        { error: "Invalid tariff plan ID" },
        { status: 400 }
      )
    }

    const { services } = await request.json()

    const tariffPlan = await prisma.tariffPlan.findUnique({
      where: { id },
      include: {
        provider: {
          select: {
            id: true,
            facility_name: true,
            email: true,
            hmo_coordinator_email: true,
          },
        },
      },
    })

    if (!tariffPlan) {
      return NextResponse.json(
        { error: "Tariff plan not found" },
        { status: 404 }
      )
    }

    const hasPermission = await checkPermission(
      session.user.role as any,
      "provider",
      "manage_tariff_plan"
    )
    const isProviderUser = session.user.provider_id === tariffPlan.provider_id

    if (!hasPermission && !isProviderUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const allowedStatuses = ["DRAFT", "IN_PROGRESS"]

    if (!allowedStatuses.includes(tariffPlan.status)) {
      return NextResponse.json(
        {
          error: "Cannot mark plan as in-progress. Status must be DRAFT or already IN_PROGRESS",
        },
        { status: 400 }
      )
    }

    await prisma.tariffPlan.update({
      where: { id },
      data: {
        status: "IN_PROGRESS",
        rejection_reason: null,
      },
    })

    if (services && Array.isArray(services) && services.length > 0) {
      await prisma.tariffPlanService.updateMany({
        where: {
          id: { in: services },
          tariff_plan_id: id,
        },
        data: {
          is_draft: false,
        },
      })
    }

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "TARIFF_PLAN_SAVE_IN_PROGRESS",
        resource: "tariff_plan",
        resource_id: id,
        details: {
          services_count: services?.length || 0,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: "Tariff plan marked as in-progress",
    })
  } catch (error) {
    console.error("Error saving tariff plan as in-progress:", error)
    return NextResponse.json(
      { error: "Failed to mark tariff plan as in-progress" },
      { status: 500 }
    )
  }
}








