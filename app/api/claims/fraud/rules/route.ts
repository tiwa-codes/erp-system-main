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

    // Build where clause for fraud rules
    const where: any = {}
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } }
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

    // Fetch fraud rules from database
    const [rules, totalCount] = await Promise.all([
      prisma.fraudRule.findMany({
        where,
        include: {
          created_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit
      }),
      prisma.fraudRule.count({ where })
    ])

    return NextResponse.json({
      rules,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching fraud rules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fraud rules' },
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

    const canDetectFraud = await checkPermission(session.user.role as any, 'claims', 'fraud_detection')
    if (!canDetectFraud) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      category,
      description,
      field,
      operator,
      value,
      metrics,
      severity,
      risk_score_weight,
      auto_actions
    } = body

    if (!name || !category) {
      return NextResponse.json({ error: 'Name and category are required' }, { status: 400 })
    }

    // Create fraud rule in database
    const newRule = await prisma.fraudRule.create({
      data: {
        name,
        category,
        description: description || '',
        severity: severity || 'MEDIUM',
        conditions: body.conditions || [],
        auto_action: body.auto_action || '',
        risk_score_weight: risk_score_weight || 50,
        created_by_id: session.user.id
      },
      include: {
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'FRAUD_RULE_CREATE',
        resource: 'fraud_rule',
        resource_id: newRule.id,
        new_values: newRule,
      },
    })

    return NextResponse.json(newRule, { status: 201 })
  } catch (error) {
    console.error('Error creating fraud rule:', error)
    return NextResponse.json(
      { error: 'Failed to create fraud rule' },
      { status: 500 }
    )
  }
}
