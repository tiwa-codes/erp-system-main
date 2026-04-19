import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { createAuditLog } from "@/lib/audit"

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
    const body = await request.json()
    const { action, comments } = body // action: 'approve' or 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: "Invalid action. Must be 'approve' or 'reject'" }, { status: 400 })
    }

    // Fetch the telemedicine request
    const telemedicineRequest = await prisma.telemedicineRequest.findUnique({
      where: { id: requestId },
      include: {
        enrollee: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true
          }
        },
        facility: {
          select: {
            id: true,
            facility_name: true
          }
        }
      }
    })

    if (!telemedicineRequest) {
      return NextResponse.json({ error: "Telemedicine request not found" }, { status: 404 })
    }

    if (telemedicineRequest.status !== 'PENDING') {
      return NextResponse.json({ error: "Request has already been processed" }, { status: 400 })
    }

    // Update the request status
    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'
    
    const updatedRequest = await prisma.telemedicineRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus as any,
        updated_at: new Date()
      }
    })

    // If approved, update the corresponding order status
    if (action === 'approve') {
      if (telemedicineRequest.request_type === 'LAB') {
        if (!telemedicineRequest.appointment_id || !telemedicineRequest.facility_id || !telemedicineRequest.test_name) {
          return NextResponse.json({ error: "Incomplete lab request data" }, { status: 400 })
        }
        await prisma.labOrder.updateMany({
          where: {
            appointment_id: telemedicineRequest.appointment_id,
            facility_id: telemedicineRequest.facility_id,
            test_name: telemedicineRequest.test_name
          },
          data: {
            status: 'PENDING' // Keep as PENDING until facility submits results
          }
        })
      } else if (telemedicineRequest.request_type === 'RADIOLOGY') {
        if (!telemedicineRequest.appointment_id || !telemedicineRequest.facility_id || !telemedicineRequest.test_name) {
          return NextResponse.json({ error: "Incomplete radiology request data" }, { status: 400 })
        }
        await prisma.radiologyOrder.updateMany({
          where: {
            appointment_id: telemedicineRequest.appointment_id,
            facility_id: telemedicineRequest.facility_id,
            test_name: telemedicineRequest.test_name
          },
          data: {
            status: 'PENDING' // Keep as PENDING until facility submits results
          }
        })
      }
    }

    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      action: `TELEMEDICINE_REQUEST_${action.toUpperCase()}`,
      resource: "telemedicine_request",
      resourceId: requestId,
      newValues: {
        requestId,
        action,
        status: newStatus,
        comments,
        enrolleeId: telemedicineRequest.enrollee.enrollee_id,
        requestType: telemedicineRequest.request_type,
        testName: telemedicineRequest.test_name
      }
    })

    return NextResponse.json({
      success: true,
      message: `Telemedicine request ${action}d successfully`,
      telemedicineRequest: updatedRequest
    })
  } catch (error) {
    console.error("Error processing telemedicine request:", error)
    return NextResponse.json(
      { error: "Failed to process telemedicine request" },
      { status: 500 }
    )
  }
}
