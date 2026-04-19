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

    // Check if user has call-centre permissions
    const hasPermission = await checkPermission(session.user.role as any, "call-centre", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Get call centre metrics
    const [
      approvalCodes,
      encounterCodes,
      eligibilityProcess,
      requestsToday
    ] = await Promise.all([
      // Total approval codes
      prisma.approvalCode.count(),
      // Total encounter codes (using claims as proxy)
      prisma.claim.count(),
      // Eligibility process (plans with limits)
      prisma.plan.count({
        where: {
          annual_limit: { gt: 0 }
        }
      }),
      // Requests today (using claims as proxy for provider requests)
      prisma.claim.count({
        where: {
          created_at: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      })
    ])

    const metrics = {
      approval_codes: approvalCodes,
      encounter_codes: encounterCodes,
      eligibility_process: eligibilityProcess,
      requests: requestsToday
    }

    return NextResponse.json({
      success: true,
      metrics
    })

  } catch (error) {
    console.error("Error fetching call centre metrics:", error)
    return NextResponse.json(
      { error: "Failed to fetch call centre metrics" },
      { status: 500 }
    )
  }
}
