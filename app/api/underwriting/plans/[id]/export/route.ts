import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { buildPlanCustomizationReview } from "@/lib/plan-customization-review"
import { buildPlanCustomizationWorkbook } from "@/lib/plan-customization-export"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "underwriting", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const plan = await prisma.plan.findUnique({
      where: { id: params.id },
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

    const customizations = await buildPlanCustomizationReview(plan)
    const buffer = buildPlanCustomizationWorkbook(plan, customizations)
    const dateTag = new Date().toISOString().split("T")[0]

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="underwriting-custom-plan-${plan.plan_id ?? plan.id}-${dateTag}.xlsx"`,
      },
    })
  } catch (error) {
    console.error("Error exporting Underwriting custom plan:", error)
    return NextResponse.json({ error: "Failed to export plan" }, { status: 500 })
  }
}
