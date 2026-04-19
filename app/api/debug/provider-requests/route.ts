import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get all provider requests
    const providerRequests = await prisma.providerRequest.findMany({
      include: {
        provider: {
          select: {
            id: true,
            facility_name: true,
            facility_type: true
          }
        },
        enrollee: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    })

    // Format provider requests
    const formattedRequests = providerRequests.map(request => ({
      id: request.id,
      request_id: `REQ-${request.id.slice(-8).toUpperCase()}`,
      provider_name: request.provider?.facility_name || 'Unknown Provider',
      hospital_name: request.hospital,
      services: request.services,
      amount: request.amount,
      status: request.status,
      date: request.created_at,
      provider: request.provider,
      enrollee: request.enrollee
    }))

    return NextResponse.json({
      success: true,
      provider_requests: formattedRequests,
      total: formattedRequests.length
    })

  } catch (error) {
    console.error("Error fetching provider requests:", error)
    return NextResponse.json(
      { error: "Failed to fetch provider requests" },
      { status: 500 }
    )
  }
}
