import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission, getPermissionsForRole } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission - allow if HR view OR if user has manage_memos in any module
    const userPermissions = await getPermissionsForRole(session.user.role as any)
    const canView = userPermissions.some(p =>
      (p.module === 'hr' && p.action === 'view') ||
      p.action === 'manage_memos'
    )

    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const employee = searchParams.get('employee') || ''
    const priority = searchParams.get('priority') || ''
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Build where clause
    const where: any = {}

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (employee && employee !== 'all') {
      where.employee_id = employee
    }

    if (priority && priority !== 'all') {
      where.priority = priority
    }

    if (status && status !== 'all') {
      where.status = status
    }

    // Get total count for pagination
    const total = await prisma.memo.count({ where })

    // Get memos with pagination
    const memos = await prisma.memo.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            employee_id: true,
            email: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    })

    // Fetch creators from AuditLog
    const memoIds = memos.map(m => m.id)
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        resource: 'Memo',
        action: 'CREATE',
        resource_id: { in: memoIds }
      },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    })

    const departmentIds = auditLogs
      .map(l => (l.new_values as any)?.department_id)
      .filter(Boolean) as string[]

    const departments = await prisma.department.findMany({
      where: { id: { in: departmentIds } },
      select: { id: true, name: true }
    })

    const departmentMap = new Map(departments.map(d => [d.id, d]))

    // Map creators + meta to memos
    const memosWithSender = memos.map(memo => {
      const log = auditLogs.find(l => l.resource_id === memo.id)
      const newValues = (log?.new_values || {}) as any
      const originDepartment = newValues.department_id ? departmentMap.get(newValues.department_id) : null
      const attachment = newValues.attachment || null

      return {
        ...memo,
        sender: log?.user || null,
        origin_department: originDepartment,
        attachment
      }
    })

    const pages = Math.ceil(total / limit)

    return NextResponse.json({
      memos: memosWithSender,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    })
  } catch (error) {
    console.error('Error fetching memos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch memos' },
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

    // Check permission - allow if HR add OR if user has manage_memos in any module
    const userPermissions = await getPermissionsForRole(session.user.role as any)
    const canCreate = userPermissions.some(p =>
      (p.module === 'hr' && p.action === 'add') ||
      p.action === 'manage_memos'
    )

    if (!canCreate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const {
      title,
      content,
      employee_id,
      priority
    } = await request.json()

    // Validate required fields
    if (!title || !content || !employee_id) {
      return NextResponse.json({
        error: 'Missing required fields',
        message: 'Title, content, and employee are required'
      }, { status: 400 })
    }

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employee_id }
    })

    if (!employee) {
      return NextResponse.json({
        error: 'Employee not found',
        message: 'The selected employee does not exist'
      }, { status: 400 })
    }

    const memo = await prisma.memo.create({
      data: {
        title,
        content,
        employee_id,
        priority: priority || 'NORMAL',
        status: 'UNREAD'
      },
      include: {
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            employee_id: true,
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
        resource: 'Memo',
        resource_id: memo.id,
        new_values: {
          title: memo.title,
          employee_id: memo.employee_id,
          priority: memo.priority
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Memo created successfully',
      memo
    })
  } catch (error) {
    console.error('Error creating memo:', error)
    return NextResponse.json(
      { error: 'Failed to create memo' },
      { status: 500 }
    )
  }
}
