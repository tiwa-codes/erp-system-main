import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const canView = await checkPermission(session.user.role as any, 'hr', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const ruleType = searchParams.get('ruleType') || ''
    const isActive = searchParams.get('isActive') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (ruleType && ruleType !== 'all') {
      where.rule_type = ruleType
    }

    if (isActive && isActive !== 'all') {
      where.is_active = isActive === 'true'
    }

    // Get total count for pagination
    const total = await prisma.hRRule.count({ where })

    // Get HR rules with pagination
    const hrRules = await prisma.hRRule.findMany({
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
      orderBy: [
        { priority: 'desc' },
        { created_at: 'desc' }
      ],
      skip: (page - 1) * limit,
      take: limit
    })

    const pages = Math.ceil(total / limit)

    return NextResponse.json({
      hrRules,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    })
  } catch (error) {
    console.error('Error fetching HR rules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch HR rules' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const canCreate = await checkPermission(session.user.role as any, 'hr', 'add')
    if (!canCreate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const {
      name,
      description,
      rule_type,
      conditions,
      actions,
      is_active,
      priority
    } = await request.json()

    // Validate required fields
    if (!name || !rule_type || !conditions || !actions) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        message: 'Name, rule type, conditions, and actions are required'
      }, { status: 400 })
    }

    // Validate JSON fields
    try {
      JSON.parse(JSON.stringify(conditions))
      JSON.parse(JSON.stringify(actions))
    } catch (error) {
      return NextResponse.json({ 
        error: 'Invalid JSON format',
        message: 'Conditions and actions must be valid JSON'
      }, { status: 400 })
    }

    const hrRule = await prisma.hRRule.create({
      data: {
        name,
        description: description || null,
        rule_type,
        conditions,
        actions,
        is_active: is_active !== undefined ? is_active : true,
        priority: priority || 0,
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
        action: 'CREATE',
        resource: 'HRRule',
        resource_id: hrRule.id,
        new_values: {
          name: hrRule.name,
          rule_type: hrRule.rule_type,
          is_active: hrRule.is_active
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'HR Rule created successfully',
      hrRule
    })
  } catch (error) {
    console.error('Error creating HR rule:', error)
    return NextResponse.json(
      { error: 'Failed to create HR rule' },
      { status: 500 }
    )
  }
}
