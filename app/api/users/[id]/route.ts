import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to view users
    const canView = await checkPermission(session.user.role as any, 'users', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        department: true,
        role: true,
        provider: {
          select: {
            id: true,
            facility_name: true,
          },
        },
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      title: user.title,
      phone_number: user.phone_number,
      contact_address: user.contact_address,
      date_of_birth: user.date_of_birth,
      gender: user.gender,
      role: user.role?.name || 'N/A',
      status: user.status,
      department_id: user.department_id,
      department: user.department,
      provider_id: user.provider_id,
      provider: user.provider,
      custom_role: null,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login_at: user.last_login_at
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
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
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to edit users
    const canEdit = await checkPermission(session.user.role as any, 'users', 'edit')
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      title,
      dateOfBirth,
      gender,
      contactAddress,
      role,
      departmentId,
      providerId,
      status,
    } = body

    // Find the role by name
    const roleRecord = await prisma.role.findFirst({
      where: { name: role }
    })
    
    if (!roleRecord) {
      return NextResponse.json({ error: 'Invalid role specified' }, { status: 400 })
    }

    // Validate provider selection for PROVIDER role
    if (role === 'PROVIDER' && !providerId) {
      return NextResponse.json({ error: 'Provider selection is required for PROVIDER role' }, { status: 400 })
    }

    // Check if email is already taken by another user
    const existingUser = await prisma.user.findFirst({
      where: { 
        email,
        NOT: { id }
      }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }

    const userData = {
      first_name: firstName,
      last_name: lastName,
      email,
      phone_number: phoneNumber,
      title,
      date_of_birth: dateOfBirth ? new Date(dateOfBirth) : null,
      gender,
      contact_address: contactAddress,
      role_id: roleRecord.id,
      status: (status as any) || 'ACTIVE',
      department_id: departmentId || null,
      provider_id: providerId || null,
    }
    
    const user = await prisma.user.update({
      where: { id },
      data: userData,
      include: {
        department: true,
        provider: true,
        role: true
      }
    })

    // Log the user update
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'USER_UPDATED',
        resource: 'user',
        resource_id: id,
        old_values: body.oldValues || {},
        new_values: userData
      }
    })

    return NextResponse.json({
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      role: user.role?.name || 'N/A',
      department: user.department?.name || 'N/A',
      provider: user.provider?.facility_name || 'N/A',
      phone: user.phone_number,
      status: user.status
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
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
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to delete users
    const canDelete = await checkPermission(session.user.role as any, 'users', 'delete')
    if (!canDelete) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent deleting own account
    if (user.id === session.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status: 'INACTIVE' }
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'USER_DEACTIVATED',
        resource: 'user',
        resource_id: id,
        old_values: {
          name: `${user.first_name} ${user.last_name}`,
          email: user.email,
          role: user.role,
          status: user.status
        },
        new_values: {
          status: updatedUser.status
        }
      }
    })

    return NextResponse.json({
      title: 'User deactivated',
      message: `${user.first_name} ${user.last_name} has been set to inactive.`
    })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to edit users
    const canEdit = await checkPermission(session.user.role as any, 'users', 'edit')
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update user status
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status: status as any },
      include: {
        department: true,
        provider: true
      }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'USER_STATUS_UPDATE',
        resource: 'user',
        resource_id: id,
        old_values: { status: existingUser.status },
        new_values: { status },
      },
    })

    return NextResponse.json({
      id: updatedUser.id,
      name: `${updatedUser.first_name} ${updatedUser.last_name}`,
      email: updatedUser.email,
      role: updatedUser.role,
      department: updatedUser.department?.name || 'N/A',
      provider: updatedUser.provider?.facility_name || 'N/A',
      phone: updatedUser.phone_number,
      status: updatedUser.status
    })
  } catch (error) {
    console.error('Error updating user status:', error)
    return NextResponse.json(
      { error: 'Failed to update user status' },
      { status: 500 }
    )
  }
}
