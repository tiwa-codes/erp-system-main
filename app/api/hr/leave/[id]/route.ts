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
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const canEdit = await checkPermission(session.user.role as any, 'hr', 'edit')
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params
    const { action } = await request.json()

    // Check if leave request exists
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: true
      }
    })

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
    }

    if (leaveRequest.status !== 'PENDING') {
      return NextResponse.json({ 
        error: 'Leave request already processed',
        message: 'This leave request has already been processed'
      }, { status: 400 })
    }

    let updatedLeaveRequest
    let newStatus
    let actionType

    if (action === 'approve') {
      newStatus = 'APPROVED'
      actionType = 'APPROVE'
      updatedLeaveRequest = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approved_by: session.user.id,
          approved_at: new Date()
        }
      })
    } else if (action === 'reject') {
      newStatus = 'REJECTED'
      actionType = 'REJECT'
      updatedLeaveRequest = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          approved_by: session.user.id,
          approved_at: new Date()
        }
      })
    } else {
      return NextResponse.json({ 
        error: 'Invalid action',
        message: 'Action must be either "approve" or "reject"'
      }, { status: 400 })
    }

    // Log the leave request update
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: actionType,
        resource: 'leave_requests',
        resource_id: id,
        old_values: {
          status: leaveRequest.status
        },
        new_values: {
          status: newStatus,
          approved_by: session.user.id,
          approved_at: new Date()
        },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedLeaveRequest,
      message: `Leave request ${action}d successfully`
    })

  } catch (error) {
    console.error('Error updating leave request:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update leave request',
      message: 'An error occurred while updating the leave request'
    }, { status: 500 })
  }
}
