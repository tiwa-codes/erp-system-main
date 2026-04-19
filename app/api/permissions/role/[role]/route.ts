import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: { role: string } }
) {
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

    const { role } = params
    const roleRecord = await prisma.role.findFirst({
      where: { name: { equals: role, mode: 'insensitive' } }
    })

    if (!roleRecord) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    const permissions = await prisma.permission.findMany({
      where: { role_id: roleRecord.id },
      orderBy: [{ module: 'asc' }, { submodule: 'asc' }, { action: 'asc' }]
    })

    return NextResponse.json(permissions)
  } catch (error) {
    console.error('Error fetching role permissions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch role permissions' },
      { status: 500 }
    )
  }
}
