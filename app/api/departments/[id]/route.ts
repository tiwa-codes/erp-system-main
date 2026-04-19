import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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
    const { name, description } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 })
    }

    // Check if department exists
    const existingDepartment = await prisma.department.findUnique({
      where: { id }
    })

    if (!existingDepartment) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }

    // Check if name is already taken by another department
    const nameExists = await prisma.department.findFirst({
      where: { 
        name,
        NOT: { id }
      }
    })

    if (nameExists) {
      return NextResponse.json({ error: 'Department name already exists' }, { status: 400 })
    }

    const department = await prisma.department.update({
      where: { id },
      data: {
        name,
        description
      }
    })

    // Log the department update
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'UPDATE',
        resource: 'departments',
        resource_id: department.id,
        old_values: {
          name: existingDepartment.name,
          description: existingDepartment.description
        },
        new_values: {
          name: department.name,
          description: department.description
        },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({
      success: true,
      data: department,
      message: 'Department updated successfully'
    })

  } catch (error) {
    console.error('Error updating department:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update department',
      message: 'An error occurred while updating the department'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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

    const { id } = params

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        users: true
      }
    })

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }

    // Check if department has users
    if (department.users && department.users.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete department with assigned users',
        message: 'Please reassign or remove all users from this department before deleting'
      }, { status: 400 })
    }

    await prisma.department.delete({
      where: { id }
    })

    // Log the department deletion
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'DELETE',
        resource: 'departments',
        resource_id: id,
        old_values: {
          name: department.name,
          description: department.description
        },
        new_values: {},
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Department deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting department:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to delete department',
      message: 'An error occurred while deleting the department'
    }, { status: 500 })
  }
}
