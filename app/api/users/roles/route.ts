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

export async function GET(request: NextRequest) {
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

    // Fetch roles from database only
    const dbRoles = await prisma.role.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        is_system: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: {
            users: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    // Format roles for response
    const formattedRoles = dbRoles.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description,
      userCount: role._count.users,
      permissions: ['all'], // Default permissions for now
      createdAt: role.created_at.toISOString(),
      updatedAt: role.updated_at.toISOString()
    }))

    return NextResponse.json({
      roles: formattedRoles,
      total: formattedRoles.length
    })
  } catch (error) {
    console.error('Error fetching roles:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch roles',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to add roles
    const canAdd = await checkPermission(session.user.role as any, 'users', 'add')
    if (!canAdd) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, permissions } = body

    if (!name || !description) {
      return NextResponse.json({ 
        error: 'Name and description are required' 
      }, { status: 400 })
    }

    // Check if role already exists in database
    const existingDbRole = await prisma.role.findFirst({
      where: { name: name.toUpperCase() }
    })
    if (existingDbRole) {
      return NextResponse.json({ 
        error: 'Role already exists' 
      }, { status: 400 })
    }

    // Create new role in database
    const newRole = await prisma.role.create({
      data: {
        name: name.toUpperCase(),
        description,
        is_system: false,
        is_active: true
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
        action: 'ROLE_CREATE',
        resource: 'role',
        resource_id: newRole.id,
        new_values: {
          name: newRole.name,
          description: newRole.description
        }
      }
    })

    return NextResponse.json({
      success: true,
      role: {
        id: newRole.id,
        name: newRole.name,
        description: newRole.description,
        userCount: newRole._count.users,
        permissions: ['all'], // Default permissions
        createdAt: newRole.created_at.toISOString(),
        updatedAt: newRole.updated_at.toISOString()
      },
      message: 'Role created successfully'
    })
  } catch (error) {
    console.error('Error creating role:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create role',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}