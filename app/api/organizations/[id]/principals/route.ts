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

    const principals = await prisma.principalAccount.findMany({
      where: { 
        organization_id: id 
      },
      include: {
        dependents: true
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    return NextResponse.json({ principals })
  } catch (error) {
    console.error('Error fetching organization principals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch principals' },
      { status: 500 }
    )
  }
}
