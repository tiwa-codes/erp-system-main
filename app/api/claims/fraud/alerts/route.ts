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
    const search = searchParams.get('search') || ''
    const severity = searchParams.get('severity') || ''
    const startDate = searchParams.get('start_date') || ''
    const endDate = searchParams.get('end_date') || ''

    const skip = (page - 1) * limit

    // Build where clause for fraud alerts
    const where: any = {}
    
    if (search) {
      where.OR = [
        { claim: { claim_number: { contains: search, mode: 'insensitive' } } },
        { claim: { provider: { facility_name: { contains: search, mode: 'insensitive' } } } },
        { claim: { principal: { 
          OR: [
            { first_name: { contains: search, mode: 'insensitive' } },
            { last_name: { contains: search, mode: 'insensitive' } }
          ]
        }}}
      ]
    }

    if (severity && severity !== 'all') {
      where.severity = severity
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

    const [alerts, total] = await Promise.all([
      prisma.fraudAlert.findMany({
        where,
        include: {
          claim: {
            select: {
              id: true,
              claim_number: true,
              amount: true,
              provider: {
                select: {
                  facility_name: true
                }
              },
              principal: {
                select: {
                  first_name: true,
                  last_name: true,
                  enrollee_id: true
                }
              }
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.fraudAlert.count({ where })
    ])

    return NextResponse.json({
      alerts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching fraud alerts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fraud alerts' },
      { status: 500 }
    )
  }
}
