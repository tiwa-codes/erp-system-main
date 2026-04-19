import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has request-from-provider permissions
    const hasPermission = await checkPermission(session.user.role as any, "request-from-provider", "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { reason } = body

    // Validate rejection reason is provided and not empty
    if (!reason || !reason.trim()) {
      return NextResponse.json({
        error: "Rejection reason is required. Please provide a reason for rejecting this request."
      }, { status: 400 })
    }

    // Find the provider request
    const providerRequest = await prisma.providerRequest.findUnique({
      where: { id },
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

    if (!providerRequest) {
      return NextResponse.json({ error: "Provider request not found" }, { status: 404 })
    }

    // Update the provider request status to rejected
    const updatedRequest = await prisma.providerRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejection_reason: reason || 'Rejected by call centre'
      },
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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "PROVIDER_REQUEST_REJECTED",
        resource: "provider_request",
        resource_id: providerRequest.id,
        old_values: providerRequest,
        new_values: updatedRequest
      }
    })

    return NextResponse.json({
      success: true,
      message: "Request rejected successfully",
      provider_request: {
        id: updatedRequest.id,
        request_id: updatedRequest.request_id,
        provider_name: updatedRequest.provider.facility_name,
        hospital_name: updatedRequest.hospital,
        services: updatedRequest.services,
        amount: updatedRequest.amount,
        status: updatedRequest.status,
        rejection_reason: updatedRequest.rejection_reason,
        date: updatedRequest.created_at
      }
    })

  } catch (error) {
    console.error("Error rejecting provider request:", error)
    return NextResponse.json(
      { error: "Failed to reject provider request" },
      { status: 500 }
    )
  }
}
