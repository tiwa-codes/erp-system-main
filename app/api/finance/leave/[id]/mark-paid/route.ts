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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission
    const canUpdate = await checkPermission(session.user.role as any, 'finance', 'edit')
    if (!canUpdate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params

    // Check if leave request exists
    const existingLeaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            department: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    if (!existingLeaveRequest) {
      return NextResponse.json({ 
        error: "Leave request not found",
        message: "The specified leave request does not exist"
      }, { status: 404 })
    }

    // Check if leave request is already approved
    if (existingLeaveRequest.status !== 'APPROVED') {
      return NextResponse.json({ 
        error: "Leave request must be approved first",
        message: "Only approved leave requests can be marked as paid"
      }, { status: 400 })
    }

    // Update leave request status to PAID
    const updatedLeaveRequest = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'PAID',
        updated_by: session.user.id,
        updated_at: new Date()
      },
      include: {
        employee: {
          include: {
            department: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    // Log the update action
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'UPDATE',
        resource: 'leave_requests',
        resource_id: id,
        old_values: {
          status: existingLeaveRequest.status
        },
        new_values: {
          status: 'PAID'
        },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedLeaveRequest,
      message: 'Leave request marked as paid successfully'
    })

  } catch (error) {
    console.error("Error marking leave request as paid:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to mark leave request as paid",
      message: "An error occurred while updating the leave request"
    }, { status: 500 })
  }
}
