import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { sendTariffPlanSubmissionNotification } from "@/lib/notifications"

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

    // Get existing tariff plan with services
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
        tariff_plan_services: true,
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

    // Check permissions
    const hasPermission = await checkPermission(session.user.role as any, "provider", "manage_tariff_plan")
    const isProviderUser = session.user.provider_id === tariffPlan.provider_id

    if (!hasPermission && !isProviderUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { is_customized = true } = await request.json()

    // Only allow submission if status is editable.
    if (!["DRAFT", "REJECTED", "IN_PROGRESS"].includes(tariffPlan.status)) {
      return NextResponse.json(
        {
          error: "Cannot submit tariff plan. Status must be DRAFT, REJECTED, or IN_PROGRESS",
        },
        { status: 400 }
      )
    }

    // Validate against current provider services and attach them to the active plan.
    const servicesWithPrices = await prisma.tariffPlanService.findMany({
      where: {
        provider_id: tariffPlan.provider_id,
        status: "ACTIVE",
        price: { gt: 0 },
      },
      select: { id: true },
    })

    if (servicesWithPrices.length === 0) {
      return NextResponse.json(
        {
          error: "Cannot submit tariff plan. At least one service with a price is required",
        },
        { status: 400 }
      )
    }

    await prisma.tariffPlanService.updateMany({
      where: {
        provider_id: tariffPlan.provider_id,
      },
      data: {
        tariff_plan_id: id,
      },
    })

    const planUpdateData: any = {
      submitted_at: new Date(),
      rejection_reason: null,
      is_customized: Boolean(is_customized),
    }

    if (is_customized) {
      planUpdateData.status = "PENDING_APPROVAL"
      planUpdateData.approval_stage = "UNDERWRITING"
    } else {
      // "Accept All Tariffs" should still move through final MD review.
      planUpdateData.status = "PENDING_APPROVAL"
      planUpdateData.approval_stage = "MD"
    }

    const updatedPlan = await prisma.tariffPlan.update({
      where: { id },
      data: planUpdateData,
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

    // Mark all services as not draft and ensure they're ACTIVE
    const updateResult = await prisma.tariffPlanService.updateMany({
      where: {
        tariff_plan_id: id,
      },
      data: {
        is_draft: false,
        status: 'ACTIVE', // Ensure all services are ACTIVE when submitted
      },
    })

    // Debug: Log how many services were updated
    console.log(`Tariff plan ${id} submission: Updated ${updateResult.count} services (set is_draft=false, status=ACTIVE)`)

    // Verify all services are properly linked
    const servicesCount = await prisma.tariffPlanService.count({
      where: {
        tariff_plan_id: id,
        status: 'ACTIVE',
      },
    })
    console.log(`Tariff plan ${id} has ${servicesCount} ACTIVE services after submission`)

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "TARIFF_PLAN_SUBMIT",
        resource: "tariff_plan",
        resource_id: id,
        new_values: {
          status: planUpdateData.status,
          approval_stage: planUpdateData.approval_stage,
          is_customized: planUpdateData.is_customized,
          submitted_at: updatedPlan.submitted_at,
          services_count: updatedPlan._count.tariff_plan_services,
        },
      },
    })

    // Send email notification to Provider Management Team
    try {
      await sendTariffPlanSubmissionNotification({
        tariffPlan: updatedPlan,
        provider: tariffPlan.provider,
      })
    } catch (emailError) {
      console.error("Failed to send email notification:", emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: "Tariff plan submitted for approval successfully",
      tariffPlan: updatedPlan,
    })
  } catch (error) {
    console.error("Error submitting tariff plan:", error)
    return NextResponse.json(
      { error: "Failed to submit tariff plan" },
      { status: 500 }
    )
  }
}
