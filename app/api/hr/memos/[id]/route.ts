import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const canView = await checkPermission(session.user.role as any, 'hr', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const memo = await prisma.memo.findUnique({
      where: { id: params.id },
      include: {
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            employee_id: true,
            email: true,
            position: true,
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

    if (!memo) {
      return NextResponse.json({ error: 'Memo not found' }, { status: 404 })
    }

    return NextResponse.json({ memo })
  } catch (error) {
    console.error('Error fetching memo:', error)
    return NextResponse.json(
      { error: 'Failed to fetch memo' },
      { status: 500 }
    )
  }
}

export async function PUT(
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

    const body = await request.json()
    
    // Check if this is a status-only update (from mark as read)
    if (body.status && Object.keys(body).length === 1) {
      return handleStatusUpdate(params.id, body.status, session.user.id)
    }

    const {
      title,
      content,
      employee_id,
      priority,
      status
    } = body

    // Get existing memo for audit trail
    const existingMemo = await prisma.memo.findUnique({
      where: { id: params.id }
    })

    if (!existingMemo) {
      return NextResponse.json({ error: 'Memo not found' }, { status: 404 })
    }

    // Validate required fields for full update
    if (!title || !content || !employee_id) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        message: 'Title, content, and employee are required'
      }, { status: 400 })
    }

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employee_id }
    })

    if (!employee) {
      return NextResponse.json({ 
        error: 'Employee not found',
        message: 'The selected employee does not exist'
      }, { status: 400 })
    }

    const updatedMemo = await prisma.memo.update({
      where: { id: params.id },
      data: {
        title,
        content,
        employee_id,
        priority: priority || existingMemo.priority,
        status: status || existingMemo.status
      },
      include: {
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            employee_id: true,
            email: true
          }
        }
      }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'UPDATE',
        resource: 'Memo',
        resource_id: params.id,
        old_values: {
          title: existingMemo.title,
          employee_id: existingMemo.employee_id,
          priority: existingMemo.priority,
          status: existingMemo.status
        },
        new_values: {
          title: updatedMemo.title,
          employee_id: updatedMemo.employee_id,
          priority: updatedMemo.priority,
          status: updatedMemo.status
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Memo updated successfully',
      memo: updatedMemo
    })
  } catch (error) {
    console.error('Error updating memo:', error)
    return NextResponse.json(
      { error: 'Failed to update memo' },
      { status: 500 }
    )
  }
}

// Helper function to handle status-only updates
async function handleStatusUpdate(memoId: string, status: string, userId: string) {
  try {
    // Get existing memo for audit trail
    const existingMemo = await prisma.memo.findUnique({
      where: { id: memoId }
    })

    if (!existingMemo) {
      return NextResponse.json({ error: 'Memo not found' }, { status: 404 })
    }

    const updatedMemo = await prisma.memo.update({
      where: { id: memoId },
      data: { status },
      include: {
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            employee_id: true,
            email: true
          }
        }
      }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'UPDATE',
        resource: 'Memo',
        resource_id: memoId,
        old_values: {
          status: existingMemo.status
        },
        new_values: {
          status: updatedMemo.status
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Memo status updated successfully',
      memo: updatedMemo
    })
  } catch (error) {
    console.error('Error updating memo status:', error)
    return NextResponse.json(
      { error: 'Failed to update memo status' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const canDelete = await checkPermission(session.user.role as any, 'hr', 'delete')
    if (!canDelete) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get existing memo for audit trail
    const existingMemo = await prisma.memo.findUnique({
      where: { id: params.id }
    })

    if (!existingMemo) {
      return NextResponse.json({ error: 'Memo not found' }, { status: 404 })
    }

    await prisma.memo.delete({
      where: { id: params.id }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'DELETE',
        resource: 'Memo',
        resource_id: params.id,
        old_values: {
          title: existingMemo.title,
          employee_id: existingMemo.employee_id,
          priority: existingMemo.priority,
          status: existingMemo.status
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Memo deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting memo:', error)
    return NextResponse.json(
      { error: 'Failed to delete memo' },
      { status: 500 }
    )
  }
}
