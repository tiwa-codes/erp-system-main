import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission, invalidatePermissionCache } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to view permissions
    const canView = await checkPermission(session.user.role as any, 'users', 'manage_permissions')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')

    if (!role) {
      return NextResponse.json({ error: 'Role parameter is required' }, { status: 400 })
    }

    // Find the role in the database
    const roleRecord = await prisma.role.findFirst({
      where: { name: role }
    })
    
    if (!roleRecord) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Fetch permissions for this role - include submodule
    const permissions = await prisma.permission.findMany({
      where: { 
        role_id: roleRecord.id,
        allowed: true 
      },
      select: {
        module: true,
        submodule: true,
        action: true,
        allowed: true
      },
      orderBy: [{ module: 'asc' }, { submodule: 'asc' }, { action: 'asc' }]
    })

    return NextResponse.json(permissions)
  } catch (error) {
    console.error('Error fetching permissions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
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

    // Check permission to manage permissions
    const canManage = await checkPermission(session.user.role as any, 'users', 'manage_permissions')
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { role, permissions } = body

    if (!role || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    // Find the role in the database
    const roleRecord = await prisma.role.findFirst({
      where: { name: role }
    })
    
    if (!roleRecord) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Delete existing permissions for this role
    await prisma.permission.deleteMany({
      where: { role_id: roleRecord.id }
    })

    // Create new permissions - normalize module and submodule IDs
    const normalizeId = (id: string) => (id || "").toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")
    
    const permissionData = permissions.map((perm: any) => ({
      role_id: roleRecord.id,
      module: normalizeId(perm.module),
      submodule: perm.submodule ? normalizeId(perm.submodule) : null,
      action: perm.action.toLowerCase(),
      allowed: perm.allowed
    }))

    await prisma.permission.createMany({
      data: permissionData
    })

    // Log the permission change
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PERMISSION_UPDATE',
        resource: 'permissions',
        resource_id: role,
        old_values: null, // We don't have old values in this context
        new_values: {
          role,
          permissions: permissions
        }
      }
    })

    // Invalidate permission cache for this role so changes take effect immediately
    invalidatePermissionCache(role as any)

    return NextResponse.json({ message: 'Permissions updated successfully' })
  } catch (error) {
    console.error('Error updating permissions:', error)
    return NextResponse.json(
      { error: 'Failed to update permissions' },
      { status: 500 }
    )
  }
}
