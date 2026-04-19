import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission for approving tariff plans (provider-management or executive desk).
    const [hasProviderPermission, hasExecutivePermission] = await Promise.all([
      checkPermission(session.user.role as any, "provider", "approve_tariff_plan"),
      checkPermission(session.user.role as any, "executive-desk", "approve"),
    ])

    if (!hasProviderPermission && !hasExecutivePermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const stageFilter = (searchParams.get("stage") || "").toUpperCase()
    const validStages = ["UNDERWRITING", "SPECIAL_RISK", "MD"] as const

    // Get all tariff plans with PENDING_APPROVAL status
    const tariffPlans = await prisma.tariffPlan.findMany({
      where: {
        status: "PENDING_APPROVAL",
        ...(validStages.includes(stageFilter as any)
          ? { approval_stage: stageFilter as any }
          : {}),
      },
      include: {
        provider: {
          select: {
            id: true,
            facility_name: true,
            email: true,
            phone_whatsapp: true,
          },
        },
        _count: {
          select: {
            tariff_plan_services: true,
          },
        },
      },
      orderBy: {
        submitted_at: "desc",
      },
    })

    return NextResponse.json({
      success: true,
      tariffPlans,
    })
  } catch (error) {
    console.error("Error fetching pending tariff plans:", error)
    return NextResponse.json(
      { error: "Failed to fetch pending tariff plans" },
      { status: 500 }
    )
  }
}
