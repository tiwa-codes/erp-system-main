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

    // Check permissions
    const [hasPermission, hasApprovePermission, hasExecutiveApprovalPermission] = await Promise.all([
      checkPermission(session.user.role as any, "provider", "manage_tariff_plan"),
      checkPermission(session.user.role as any, "provider", "approve_tariff_plan"),
      checkPermission(session.user.role as any, "executive-desk", "approve"),
    ])

    if (!hasPermission && !hasApprovePermission && !hasExecutiveApprovalPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get tariff plan with full details
    const tariffPlan = await prisma.tariffPlan.findUnique({
      where: { id },
      include: {
        provider: {
          select: {
            id: true,
            facility_name: true,
            email: true,
            phone_whatsapp: true,
            hmo_coordinator_email: true,
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
        tariff_plan_services: {
          // For plans in approval stages, show all ACTIVE services regardless of draft status
          // This ensures customized services are visible during review
          where: {
            status: "ACTIVE",
            // Don't filter by is_draft - show all services when plan is submitted for approval
          },
          orderBy: {
            service_name: "asc",
          },
        },
        _count: {
          select: {
            tariff_plan_services: true,
          },
        },
        msas: {
          orderBy: {
            created_at: "desc",
          },
          take: 1,
          select: {
            id: true,
            status: true,
            generated_at: true,
            signed_at: true,
            document_url: true,
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

    const underwritingAudit = await prisma.auditLog.findFirst({
      where: {
        action: "TARIFF_PLAN_STAGE_UNDERWRITING_APPROVED",
        resource: "tariff_plan",
        resource_id: id,
      },
      orderBy: {
        created_at: "desc",
      },
      select: {
        new_values: true,
      },
    })

    const negotiation_comment =
      underwritingAudit?.new_values &&
      typeof underwritingAudit.new_values === "object" &&
      underwritingAudit.new_values !== null &&
      "comments" in underwritingAudit.new_values
        ? (underwritingAudit.new_values as any).comments
        : null

    return NextResponse.json({
      success: true,
      tariffPlan,
      negotiation_comment,
    })
  } catch (error) {
    console.error("Error fetching tariff plan:", error)
    return NextResponse.json(
      { error: "Failed to fetch tariff plan" },
      { status: 500 }
    )
  }
}
