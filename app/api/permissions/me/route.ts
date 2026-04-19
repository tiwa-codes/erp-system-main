import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPermissionsForRole } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get permissions for the current user's role
    // Note: user.role might be the role name string (e.g., "TELEMEDICINE FACILITIES" or "CALL CENTRE")
    const permissions = await getPermissionsForRole(session.user.role as any)

    return NextResponse.json(permissions)
  } catch (error) {
    console.error('Error in /api/permissions/me:', error)
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    )
  }
}
