import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

const SYSTEM_ROLES = [
  {
    id: 'super_admin',
    name: 'SUPER_ADMIN',
    description: 'Full system access with all permissions',
    userCount: 0,
    permissions: ['all'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'admin',
    name: 'ADMIN',
    description: 'Administrative access to most modules',
    userCount: 0,
    permissions: ['dashboard', 'hr', 'claims', 'finance', 'provider', 'underwriting', 'reports', 'users'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'hr_manager',
    name: 'HR_MANAGER',
    description: 'Human Resources management and oversight',
    userCount: 0,
    permissions: ['hr'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'hr_officer',
    name: 'HR_OFFICER',
    description: 'Human Resources operational tasks',
    userCount: 0,
    permissions: ['hr'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'claims_processor',
    name: 'CLAIMS_PROCESSOR',
    description: 'Claims processing and validation',
    userCount: 0,
    permissions: ['claims'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'claims_manager',
    name: 'CLAIMS_MANAGER',
    description: 'Claims management and approval',
    userCount: 0,
    permissions: ['claims'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'finance_officer',
    name: 'FINANCE_OFFICER',
    description: 'Financial operations and transactions',
    userCount: 0,
    permissions: ['finance'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'provider_manager',
    name: 'PROVIDER_MANAGER',
    description: 'Provider management and oversight',
    userCount: 0,
    permissions: ['provider'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'provider',
    name: 'PROVIDER',
    description: 'Provider-specific access and operations',
    userCount: 0,
    permissions: ['provider'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'underwriter',
    name: 'UNDERWRITER',
    description: 'Underwriting operations and plan management',
    userCount: 0,
    permissions: ['underwriting'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
]

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to view roles
    const canView = await checkPermission(session.user.role as any, 'users', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // First check if it's a system role
    const systemRole = SYSTEM_ROLES.find(role => role.id === params.id || role.name === params.id)
    if (systemRole) {
      // Get user count for system role
      const roleRecord = await prisma.role.findFirst({
        where: { name: systemRole.name }
      })
      
      const userCount = roleRecord ? await prisma.user.count({
        where: { role_id: roleRecord.id }
      }) : 0

      return NextResponse.json({
        success: true,
        role: {
          ...systemRole,
          userCount,
          isSystemRole: true
        }
      })
    }

    // Check database roles
    const role = await prisma.role.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      role: {
        id: role.id,
        name: role.name,
        description: role.description,
        userCount: role._count.users,
        permissions: ['all'], // Default permissions
        createdAt: role.created_at.toISOString(),
        updatedAt: role.updated_at.toISOString(),
        isSystemRole: role.is_system
      }
    })
  } catch (error) {
    console.error('Error fetching role:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch role',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
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

    // Check permission to edit roles
    const canEdit = await checkPermission(session.user.role as any, 'users', 'edit')
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if it's a system role
    const systemRole = SYSTEM_ROLES.find(role => role.id === params.id || role.name === params.id)
    if (systemRole) {
      return NextResponse.json({ 
        error: 'Cannot edit system roles',
        message: 'System roles cannot be modified'
      }, { status: 400 })
    }

    const body = await request.json()
    const { name, description, permissions } = body

    if (!name || !description) {
      return NextResponse.json({ 
        error: 'Name and description are required' 
      }, { status: 400 })
    }

    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id: params.id }
    })

    if (!existingRole) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Check if new name conflicts with existing roles
    const conflictingRole = await prisma.role.findFirst({
      where: { 
        name: name.toUpperCase(),
        id: { not: params.id }
      }
    })

    if (conflictingRole) {
      return NextResponse.json({ 
        error: 'Role name already exists' 
      }, { status: 400 })
    }

    // Update role
    const updatedRole = await prisma.role.update({
      where: { id: params.id },
      data: {
        name: name.toUpperCase(),
        description
      },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'ROLE_UPDATE',
        resource: 'role',
        resource_id: updatedRole.id,
        old_values: {
          name: existingRole.name,
          description: existingRole.description
        },
        new_values: {
          name: updatedRole.name,
          description: updatedRole.description
        }
      }
    })

    return NextResponse.json({
      success: true,
      role: {
        id: updatedRole.id,
        name: updatedRole.name,
        description: updatedRole.description,
        userCount: updatedRole._count.users,
        permissions: ['all'], // Default permissions
        createdAt: updatedRole.created_at.toISOString(),
        updatedAt: updatedRole.updated_at.toISOString()
      },
      message: 'Role updated successfully'
    })
  } catch (error) {
    console.error('Error updating role:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update role',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
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

    // Check permission to delete roles
    const canDelete = await checkPermission(session.user.role as any, 'users', 'delete')
    if (!canDelete) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    })

    if (!existingRole) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Check if it's a system role
    if (existingRole.is_system) {
      return NextResponse.json({ 
        error: 'Cannot delete system roles',
        message: 'System roles cannot be deleted'
      }, { status: 400 })
    }

    // Check if role has users assigned
    if (existingRole._count.users > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete role with assigned users',
        message: 'Please reassign or remove users from this role before deleting'
      }, { status: 400 })
    }

    // Delete role
    await prisma.role.delete({
      where: { id: params.id }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'ROLE_DELETE',
        resource: 'role',
        resource_id: params.id,
        old_values: {
          name: existingRole.name,
          description: existingRole.description,
          permissions: existingRole.permissions
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Role deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting role:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete role',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
