import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { sendTariffPlanApprovalNotification } from "@/lib/notifications"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission for approving tariff plans
    const hasPermission = await checkPermission(
      session.user.role as any,
      "provider",
      "approve_tariff_plan"
    )

    if (!hasPermission) {
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
    const { comments } = body || {}

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

    // Only allow approval if status is PENDING_APPROVAL
    if (tariffPlan.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        {
          error: "Cannot approve tariff plan. Status must be PENDING_APPROVAL",
        },
        { status: 400 }
      )
    }

    // Update tariff plan status to APPROVED
    const updatedPlan = await prisma.tariffPlan.update({
      where: { id },
      data: {
        status: "APPROVED",
        approved_at: new Date(),
        approved_by_id: session.user.id,
        rejection_reason: null,
      },
      include: {
        provider: {
          select: {
            id: true,
            facility_name: true,
            email: true,
          },
        },
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
    })

    // Mark all services as active and not draft
    await prisma.tariffPlanService.updateMany({
      where: {
        tariff_plan_id: id,
      },
      data: {
        is_draft: false,
        status: "ACTIVE",
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "TARIFF_PLAN_APPROVE",
        resource: "tariff_plan",
        resource_id: id,
        old_values: {
          status: tariffPlan.status,
        },
        new_values: {
          status: "APPROVED",
          approved_at: updatedPlan.approved_at,
          approved_by: session.user.id,
          comments,
        },
      },
    })

    // Send email notification to provider
    try {
      await sendTariffPlanApprovalNotification({
        tariffPlan: updatedPlan,
        provider: tariffPlan.provider,
        approvedBy: updatedPlan.approved_by!,
        comments,
      })
    } catch (emailError) {
      console.error("Failed to send email notification:", emailError)
      // Don't fail the request if email fails
    }

    // Auto-generate MSA after approval
    try {
      const msaRes = await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/legal/msa/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Note: In a real implementation, you'd need to pass the session token
          // For now, this will be handled by the Legal Module manually or via a background job
        },
        body: JSON.stringify({
          provider_id: tariffPlan.provider_id,
          tariff_plan_id: id,
        }),
      })

      if (msaRes.ok) {
        const msaData = await msaRes.json()
        console.log("MSA generated automatically:", msaData.msa.id)
        
        // Auto-send MSA
        try {
          await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/legal/msa/${msaData.msa.id}/send`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          })
        } catch (sendError) {
          console.error("Failed to auto-send MSA:", sendError)
          // MSA is generated but not sent - can be sent manually later
        }
      }
    } catch (msaError) {
      console.error("Failed to auto-generate MSA:", msaError)
      // Don't fail the approval if MSA generation fails
    }

    return NextResponse.json({
      success: true,
      message: "Tariff plan approved successfully",
      tariffPlan: updatedPlan,
    })
  } catch (error) {
    console.error("Error approving tariff plan:", error)
    return NextResponse.json(
      { error: "Failed to approve tariff plan" },
      { status: 500 }
    )
  }
}

