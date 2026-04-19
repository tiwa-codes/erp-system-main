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
      telemedicineEncounters,
      rejectedServices,
      providerRequestsToday,
      pendingProviderRequests
    ] = await Promise.all([
      // Total active approval codes (non-deleted, excluding pending-only codes)
      prisma.approvalCode.count({
        where: { 
          is_deleted: false,
          status: { in: ['APPROVED', 'PARTIAL', 'REJECTED'] }
        }
      }),
      // Total telemedicine encounters (clinical encounters, not claims)
      prisma.clinicalEncounter.count(),
      // Rejected services (provider requests with REJECTED status only)
      prisma.providerRequest.count({
        where: {
          status: 'REJECTED'
        }
      }),
      // Provider requests processed today
      prisma.providerRequest.count({
        where: {
          updated_at: {
            gte: new Date(new Date().toISOString().split('T')[0] + 'T00:00:00Z')
          },
          status: { in: ['APPROVED', 'PARTIAL', 'REJECTED'] }
        }
      }),
      // Pending provider requests
      prisma.providerRequest.count({
        where: {
          status: "PENDING"
        }
      })
    ])

    const metrics = {
      approval_codes: approvalCodes,
      encounter_codes: telemedicineEncounters,
      eligibility_process: rejectedServices,
      requests: providerRequestsToday,
      pending_provider_requests: pendingProviderRequests
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
