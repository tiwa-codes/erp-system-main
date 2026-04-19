import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ProviderRequestStatus } from "@prisma/client"

export async function POST(request: NextRequest) {
  try {
    void request

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Find a provider and enrollee to create sample requests
    const provider = await prisma.provider.findFirst()
    const enrollee = await prisma.principalAccount.findFirst()

    if (!provider || !enrollee) {
      return NextResponse.json({ 
        error: "No provider or enrollee found. Please create some first." 
      }, { status: 400 })
    }

    // Create sample provider requests
    const sampleRequests = [
      {
        provider_id: provider.id,
        enrollee_id: enrollee.id,
        hospital: provider.facility_name,
        services: "Appendectomy",
        amount: 120000,
        status: ProviderRequestStatus.PENDING
      },
      {
        provider_id: provider.id,
        enrollee_id: enrollee.id,
        hospital: provider.facility_name,
        services: "Lab Test",
        amount: 5000,
        status: ProviderRequestStatus.PENDING
      },
      {
        provider_id: provider.id,
        enrollee_id: enrollee.id,
        hospital: provider.facility_name,
        services: "X-Ray",
        amount: 15000,
        status: ProviderRequestStatus.PENDING
      }
    ]

    const createdRequests = await Promise.all(
      sampleRequests.map(request => 
        prisma.providerRequest.create({
          data: request,
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
          }
        })
      )
    )

    return NextResponse.json({
      success: true,
      message: `Created ${createdRequests.length} sample provider requests`,
      requests: createdRequests.map(request => ({
        id: request.id,
        request_id: `REQ-${request.id.slice(-8).toUpperCase()}`,
        provider_name: provider.facility_name,
        hospital_name: request.hospital,
        services: request.services,
        amount: request.amount,
        status: request.status,
        date: request.created_at
      }))
    })

  } catch (error) {
    console.error("Error creating sample provider requests:", error)
    return NextResponse.json(
      { error: "Failed to create sample provider requests" },
      { status: 500 }
    )
  }
}
