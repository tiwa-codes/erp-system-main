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

    const canAccess = await checkPermission(session.user.role as any, 'claims', 'fraud_detection')
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const user = searchParams.get('user')
    const action = searchParams.get('action')

    const skip = (page - 1) * limit

    // Build where clause
    const whereClause: any = {}

    if (startDate && endDate) {
      whereClause.created_at = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    if (user && user !== 'all') {
      whereClause.user_id = user
    }

    if (action && action !== 'all') {
      whereClause.action = action.toUpperCase()
    }

    // Get audit logs related to fraud
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        ...whereClause,
        OR: [
          { action: 'CLAIM_REJECTED' },
          { action: 'CLAIM_FLAGGED' },
          { action: 'FRAUD_INVESTIGATION' },
          { action: 'CLAIM_APPROVED' },
          { action: 'INVESTIGATION_COMPLETED' }
        ]
      },
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
            role: true
          }
        }
      },
      skip,
      take: limit,
      orderBy: {
        created_at: 'desc'
      }
    })

    // Map to expected format
    const records = auditLogs.map(log => ({
      id: log.id,
      date: log.created_at.toISOString(),
      claim_id: log.resource_id || 'N/A',
      provider: 'Unknown Provider', // Will be populated separately if needed
      user_role: log.user ? 
        `${log.user.first_name} ${log.user.last_name} (${log.user.role})` : 
        'System',
      action_taken: log.action.replace('_', ' ').toLowerCase(),
      comment: log.resource || '',
      status: log.action
    }))

    // Get total count for pagination
    const total = await prisma.auditLog.count({
      where: {
        ...whereClause,
        OR: [
          { action: 'CLAIM_REJECTED' },
          { action: 'CLAIM_FLAGGED' },
          { action: 'FRAUD_INVESTIGATION' },
          { action: 'CLAIM_APPROVED' },
          { action: 'INVESTIGATION_COMPLETED' }
        ]
      }
    })

    const pagination = {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }

    return NextResponse.json({
      records,
      pagination
    })
  } catch (error) {
    console.error('Error fetching fraud history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fraud history' },
      { status: 500 }
    )
  }
}
