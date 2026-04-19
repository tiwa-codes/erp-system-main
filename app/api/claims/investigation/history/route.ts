import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canDetectFraud = await checkPermission(session.user.role as any, 'claims', 'fraud_detection')
    if (!canDetectFraud) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const startDate = searchParams.get('start_date') || ''
    const endDate = searchParams.get('end_date') || ''
    const user = searchParams.get('user') || ''
    const action = searchParams.get('action') || ''

    const skip = (page - 1) * limit

    // Build where clause for investigation history
    const where: any = {
      action: 'INVESTIGATION_ACTION'
    }
    
    if (startDate || endDate) {
      where.created_at = {}
      if (startDate) {
        where.created_at.gte = new Date(startDate)
      }
      if (endDate) {
        where.created_at.lte = new Date(endDate)
      }
    }

    if (user && user !== 'all') {
      where.user_id = user
    }

    if (action && action !== 'all') {
      where.new_values = {
        path: ['action'],
        equals: action
      }
    }

    const [records, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              role: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where })
    ])

    return NextResponse.json({
      records,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching investigation history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch investigation history' },
      { status: 500 }
    )
  }
}
