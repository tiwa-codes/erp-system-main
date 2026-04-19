import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { getUtilizationReport } from "@/lib/underwriting/usage"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const hasPermission = await checkPermission(session.user.role as any, "underwriting", "view")
    if (!hasPermission) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const planStatuses = searchParams.getAll("plan_status")
    const limitBreachesParam = searchParams.get("limit_breaches")
    const from = searchParams.get("start_date") || undefined
    const to = searchParams.get("end_date") || undefined
    const organizationId = searchParams.get("organization_id") || undefined
    const page = Number(searchParams.get("page") || "1")
    const limit = Number(searchParams.get("limit") || "20")

    let limitBreaches: boolean | undefined = undefined
    if (limitBreachesParam === "true") limitBreaches = true
    if (limitBreachesParam === "false") limitBreaches = false

    const report = await getUtilizationReport({
      planStatus: planStatuses.length ? planStatuses : undefined,
      limitBreaches,
      from,
      to,
      organizationId,
      page,
      limit,
    })

    return NextResponse.json({
      success: true,
      ...report,
    })
  } catch (error) {
    console.error("Error fetching utilization report:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch utilization report",
      },
      { status: 500 }
    )
  }
}







