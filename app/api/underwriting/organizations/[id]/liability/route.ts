import { NextRequest, NextResponse } from "next/server"
import { getOrganizationLiability } from "@/lib/underwriting/usage"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const searchParams = new URL(request.url).searchParams
    const planStatuses = searchParams.getAll("plan_status")
    const from = searchParams.get("start_date") || undefined
    const to = searchParams.get("end_date") || undefined

    const liability = await getOrganizationLiability(id, {
      planStatusFilter: planStatuses.length ? planStatuses : undefined,
      from,
      to,
    })

    return NextResponse.json({
      success: true,
      liability,
    })
  } catch (error) {
    console.error("Error fetching organization liability:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch liability" },
      { status: 500 }
    )
  }
}








