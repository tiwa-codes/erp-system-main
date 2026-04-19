import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { sendTariffPlanRejectionNotification } from "@/lib/notifications"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission for rejecting tariff plans
    const hasProviderPermission = await checkPermission(
      session.user.role as any,
      "provider",
      "approve_tariff_plan"
    )
    const hasExecutivePermission = await checkPermission(
      session.user.role as any,
      "executive-desk",
      "approve"
    )

    if (!hasProviderPermission && !hasExecutivePermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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
    const { rejection_reason } = body

    if (!rejection_reason || rejection_reason.trim() === "") {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      )
    }

    // Get existing tariff plan
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
        _count: {
          select: {
            tariff_plan_services: true,
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

    // Only allow rejection if status is PENDING_APPROVAL
    if (tariffPlan.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        {
          error: "Cannot reject tariff plan. Status must be PENDING_APPROVAL",
        },
        { status: 400 }
      )
    }

    // Update tariff plan status to REJECTED
    const updatedPlan = await prisma.tariffPlan.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejection_reason: rejection_reason.trim(),
        approved_by_id: null,
        approved_at: null,
      },
      include: {
        provider: {
          select: {
            id: true,
            facility_name: true,
            email: true,
          },
        },
        _count: {
          select: {
            tariff_plan_services: true,
          },
        },
      },
    })

    // Mark all services as draft so they can be edited
    await prisma.tariffPlanService.updateMany({
      where: {
        tariff_plan_id: id,
      },
      data: {
        is_draft: true,
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "TARIFF_PLAN_REJECT",
        resource: "tariff_plan",
        resource_id: id,
        old_values: {
          status: tariffPlan.status,
        },
        new_values: {
          status: "REJECTED",
          rejection_reason: updatedPlan.rejection_reason,
        },
      },
    })

    // Send email notification to provider
    try {
      const userDetails = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          first_name: true,
          last_name: true,
          email: true,
        },
      })

      await sendTariffPlanRejectionNotification({
        tariffPlan: updatedPlan,
        provider: tariffPlan.provider,
        rejectedBy: userDetails || {
          first_name: "Admin",
          last_name: "User",
          email: session.user.email,
        },
        rejection_reason: updatedPlan.rejection_reason!,
      })
    } catch (emailError) {
      console.error("Failed to send email notification:", emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: "Tariff plan rejected successfully",
      tariffPlan: updatedPlan,
    })
  } catch (error) {
    console.error("Error rejecting tariff plan:", error)
    return NextResponse.json(
      { error: "Failed to reject tariff plan" },
      { status: 500 }
    )
  }
}
