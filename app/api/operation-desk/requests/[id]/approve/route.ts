import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canApprove = await checkPermission(session.user.role as any, 'operation-desk', 'edit', 'procurement-bill')
    if (!canApprove) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params
    const body = await request.json().catch(() => ({}))
    const comment = typeof body?.comment === "string" ? body.comment.trim() : ""

    // Find the procurement request
    const procurementRequest = await prisma.procurementInvoice.findUnique({
      where: { id },
      include: {
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true
          }
        }
      }
    })

    if (!procurementRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (procurementRequest.status !== 'PENDING_OPERATIONS') {
      return NextResponse.json({ 
        error: 'Request has already been processed' 
      }, { status: 400 })
    }

    // Update status to PENDING_MD
    const updatedRequest = await prisma.procurementInvoice.update({
      where: { id },
      data: {
        status: 'PENDING_MD',
        operations_comment: comment || null,
        operations_by_id: session.user.id,
        operations_at: new Date(),
        updated_at: new Date()
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PROCUREMENT_OPERATIONS_APPROVED',
        resource: 'procurement_invoice',
        resource_id: id,
        old_values: procurementRequest,
        new_values: updatedRequest
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Request approved and forwarded to MD',
      request: {
        id: updatedRequest.id,
        status: updatedRequest.status,
        service_type: updatedRequest.service_type,
        department: updatedRequest.department,
        amount: updatedRequest.amount
      }
    })
  } catch (error) {
    console.error('Error approving operation desk request:', error)
    return NextResponse.json(
      { error: 'Failed to approve request' },
      { status: 500 }
    )
  }
}
