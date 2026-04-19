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
    const employee = searchParams.get('employee') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Build where clause
    const where: any = {}
    
    if (employee && employee !== 'all') {
      where.employee_id = employee
    }

    if (startDate && endDate) {
      where.start_date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    } else if (startDate) {
      where.start_date = { gte: new Date(startDate) }
    } else if (endDate) {
      where.start_date = { lte: new Date(endDate) }
    }

    // Get total count for pagination
    const total = await prisma.leaveRequest.count({ where })

    // Get leave requests with pagination
    const leaveRequests = await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          include: {
            department: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    })

    const pages = Math.ceil(total / limit)

    return NextResponse.json({
      leaveRequests,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    })

  } catch (error) {
    console.error('Error fetching leave requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leave requests' },
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
      employee_id,
      leave_type,
      start_date,
      end_date,
      reason
    } = await request.json()

    // Validate required fields
    if (!employee_id || !leave_type || !start_date || !end_date) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        message: 'Employee ID, leave type, start date, and end date are required'
      }, { status: 400 })
    }

    // Calculate days requested
    const startDate = new Date(start_date)
    const endDate = new Date(end_date)
    const daysRequested = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employee_id,
        leave_type,
        start_date: startDate,
        end_date: endDate,
        days_requested: daysRequested,
        reason,
        status: 'PENDING'
      }
    })

    // Log the leave request creation
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'CREATE',
        resource: 'leave_requests',
        resource_id: leaveRequest.id,
        old_values: {},
        new_values: {
          employee_id: leaveRequest.employee_id,
          leave_type: leaveRequest.leave_type,
          start_date: leaveRequest.start_date,
          end_date: leaveRequest.end_date,
          status: leaveRequest.status
        },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({
      success: true,
      data: leaveRequest,
      message: 'Leave request created successfully'
    })

  } catch (error) {
    console.error('Error creating leave request:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create leave request',
      message: 'An error occurred while creating the leave request'
    }, { status: 500 })
  }
}
