import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { buildPlanCustomizationReview } from "@/lib/plan-customization-review"
import { buildPlanCustomizationWorkbook } from "@/lib/plan-customization-export"

const looksLikeInternalId = (value: string) => /^[a-z0-9]{20,}$/i.test(String(value || "").trim())

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "special-risk", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const rawId = String(params.id || "").trim()
    const plan = await prisma.plan.findFirst({
      where: looksLikeInternalId(rawId)
        ? { OR: [{ id: rawId }, { plan_id: rawId }] }
        : { plan_id: rawId },
      include: {
        plan_limits: true,
        covered_services: {
          where: { status: "ACTIVE" },
          include: {
            service_type: {
              select: {
                service_name: true,
                service_category: true,
              },
            },
          },
        },
      },
    })

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    let buffer: Buffer
    try {
      const customizations = await buildPlanCustomizationReview(plan)
      buffer = buildPlanCustomizationWorkbook(plan, customizations)
    } catch (buildError) {
      console.error("Special Services export build fallback triggered:", {
        planId: plan.id,
        planCode: plan.plan_id,
        approvalStage: plan.approval_stage,
        error: buildError,
      })
      buffer = buildPlanCustomizationWorkbook(plan, [])
    }
    const dateTag = new Date().toISOString().split("T")[0]

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="special-services-custom-plan-${plan.plan_id ?? plan.id}-${dateTag}.xlsx"`,
      },
    })
  } catch (error) {
    console.error("Error exporting Special Services custom plan:", error)
    return NextResponse.json({ error: "Failed to export plan" }, { status: 500 })
  }
}
