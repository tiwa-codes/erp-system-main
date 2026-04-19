import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { enforcePlanUsage } from "@/lib/underwriting/enforcement"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has call-centre permissions
    const hasPermission = await checkPermission(session.user.role as any, "call-centre", "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const requestId = params.id

    // Find the provider request
    const providerRequest = await prisma.providerRequest.findUnique({
      where: { id: requestId },
      include: {
        provider: true,
        enrollee: true
      }
    })

    if (!providerRequest) {
      return NextResponse.json({ error: "Provider request not found" }, { status: 404 })
    }

    if (providerRequest.status !== 'PENDING') {
      return NextResponse.json({ error: "Request has already been processed" }, { status: 400 })
    }

    const enforcement = await enforcePlanUsage({
      principalId: providerRequest.enrollee_id,
      attemptedAmount: Number(providerRequest.amount || 0),
    })

    if ("error" in enforcement) {
      return NextResponse.json(
        { success: false, error: enforcement.error },
        { status: enforcement.status }
      )
    }

    if (enforcement.isBlocked) {
      await prisma.auditLog.create({
        data: {
          user_id: session.user.id,
          action: "PROVIDER_REQUEST_APPROVAL_BLOCKED",
          resource: "provider_request",
          resource_id: providerRequest.id,
          new_values: {
            reason: enforcement.warnings,
            attempted_amount: Number(providerRequest.amount || 0),
            annual_limit: enforcement.annualLimit,
            total_used: enforcement.totalUsed,
          },
        },
      })

      return NextResponse.json(
        {
          success: false,
          error: enforcement.warnings[0] || "Annual limit has been exhausted. Cannot approve this request.",
          details: {
            annual_limit: enforcement.annualLimit,
            total_used: enforcement.totalUsed,
            warnings: enforcement.warnings,
          },
        },
        { status: 400 }
      )
    }

    // Update request status
    const updatedRequest = await prisma.providerRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED'
      },
      include: {
        provider: {
          select: {
            id: true,
            facility_name: true,
            hcp_code: true
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
        action: "PROVIDER_REQUEST_PROCESS",
        resource: "provider_request",
        resource_id: requestId,
        new_values: updatedRequest
      }
    })

    return NextResponse.json({
      success: true,
      request: {
        id: updatedRequest.id,
        date: updatedRequest.created_at,
        hospital: updatedRequest.hospital,
        claim_id: updatedRequest.claim_id,
        services: updatedRequest.services,
        amount: updatedRequest.amount,
        status: updatedRequest.status,
        enrollee_id: updatedRequest.enrollee?.enrollee_id,
        enrollee_name: updatedRequest.enrollee ? 
          `${updatedRequest.enrollee.first_name} ${updatedRequest.enrollee.last_name}` : 
          null,
        provider_id: updatedRequest.provider.id,
        provider_name: updatedRequest.provider.facility_name
      }
    })

  } catch (error) {
    console.error("Error processing provider request:", error)
    return NextResponse.json(
      { error: "Failed to process provider request" },
      { status: 500 }
    )
  }
}
