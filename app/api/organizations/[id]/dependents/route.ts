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

    // Check permission to view organizations
    const canView = await checkPermission(session.user.role as any, 'underwriting', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    const dependents = await prisma.dependent.findMany({
      where: { 
        principal: {
          organization_id: id
        }
      },
      include: {
        principal: {
          select: {
            first_name: true,
            last_name: true,
            enrollee_id: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    return NextResponse.json({ dependents })
  } catch (error) {
    console.error('Error fetching organization dependents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dependents' },
      { status: 500 }
    )
  }
}
