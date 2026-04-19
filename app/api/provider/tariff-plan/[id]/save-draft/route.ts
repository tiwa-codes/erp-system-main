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

    // Validate ID
    if (!id || id === "null" || id === "undefined") {
      return NextResponse.json(
        { error: "Invalid tariff plan ID" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { services } = body // Array of service IDs to save as draft

    // Get existing tariff plan
    const tariffPlan = await prisma.tariffPlan.findUnique({
      where: { id },
      include: {
        provider: true,
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

    // Only allow saving draft if status is DRAFT or REJECTED
    if (tariffPlan.status !== "DRAFT" && tariffPlan.status !== "REJECTED") {
      return NextResponse.json(
        {
          error: "Cannot save draft. Tariff plan must be in DRAFT or REJECTED status",
        },
        { status: 400 }
      )
    }

    // Update tariff plan status to DRAFT if it was REJECTED
    if (tariffPlan.status === "REJECTED") {
      await prisma.tariffPlan.update({
        where: { id },
        data: {
          status: "DRAFT",
          rejection_reason: null,
        },
      })
    }

    // Update services to mark them as draft
    if (services && Array.isArray(services) && services.length > 0) {
      await prisma.tariffPlanService.updateMany({
        where: {
          id: { in: services },
          tariff_plan_id: id,
        },
        data: {
          is_draft: true,
        },
      })
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "TARIFF_PLAN_SAVE_DRAFT",
        resource: "tariff_plan",
        resource_id: id,
        details: {
          services_count: services?.length || 0,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: "Tariff plan saved as draft successfully",
    })
  } catch (error) {
    console.error("Error saving tariff plan draft:", error)
    return NextResponse.json(
      { error: "Failed to save tariff plan draft" },
      { status: 500 }
    )
  }
}

