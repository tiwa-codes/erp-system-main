import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to view user metrics
    const canView = await checkPermission(session.user.role as any, 'users', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get user metrics from database
    const [
      totalUsers,
      activeUsers,
      admins,
      hrManagers
    ] = await Promise.all([
      // Total Users
      prisma.user.count(),
      
      // Active Users
      prisma.user.count({
        where: { status: 'ACTIVE' }
      }),
      
      // Admins
      prisma.user.count({
        where: { 
          role: {
            name: 'ADMIN'
          }
        }
      }),
      
      // HR Managers
      prisma.user.count({
        where: { 
          role: {
            name: 'HR_MANAGER'
          }
        }
      })
    ])

    const metrics = {
      totalUsers,
      activeUsers,
      admins,
      hrManagers
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error fetching user metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user metrics' },
      { status: 500 }
    )
  }
}
