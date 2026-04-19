import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission, getDefaultPermissionsForRoleName, invalidatePermissionCache } from '@/lib/permissions'

export async function POST(
  request: NextRequest,
  { params }: { params: { role: string } }
) {
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

    const { role } = params
    const roleRecord = await prisma.role.findFirst({
      where: { name: { equals: role, mode: 'insensitive' } }
    })

    if (!roleRecord) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Delete existing permissions for this role
    await prisma.permission.deleteMany({
      where: { role_id: roleRecord.id }
    })

    // Get default permissions for this role using the shared lib function
    const defaultPermissions = getDefaultPermissionsForRoleName(roleRecord.name)

    // Create default permissions
    if (defaultPermissions.length > 0) {
      await prisma.permission.createMany({
        data: defaultPermissions.map(perm => ({
          role_id: roleRecord.id,
          module: perm.module,
          action: perm.action,
          allowed: true
        }))
      })
    }

    // Log the permission reset
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PERMISSION_RESET',
        resource: 'permissions',
        resource_id: roleRecord.name,
        new_values: {
          role: roleRecord.name,
          permissions: defaultPermissions
        }
      }
    })

    invalidatePermissionCache(roleRecord.name)

    return NextResponse.json({ message: 'Permissions reset to default successfully' })
  } catch (error) {
    console.error('Error resetting permissions:', error)
    return NextResponse.json(
      { error: 'Failed to reset permissions' },
      { status: 500 }
    )
  }
}
