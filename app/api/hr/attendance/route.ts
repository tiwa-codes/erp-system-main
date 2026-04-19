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
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    } else if (startDate) {
      where.date = { gte: new Date(startDate) }
    } else if (endDate) {
      where.date = { lte: new Date(endDate) }
    }

    // Get total count for pagination
    const total = await prisma.attendanceRecord.count({ where })

    // Get attendance records with pagination
    const attendance = await prisma.attendanceRecord.findMany({
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
        date: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    })

    const pages = Math.ceil(total / limit)

    return NextResponse.json({
      attendance,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    })

  } catch (error) {
    console.error('Error fetching attendance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attendance records' },
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
      date,
      clock_in,
      clock_out,
      status,
      notes
    } = await request.json()

    // Validate required fields
    if (!employee_id || !date) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        message: 'Employee ID and date are required'
      }, { status: 400 })
    }

    // Check if attendance record already exists for this employee and date
    const existingRecord = await prisma.attendanceRecord.findFirst({
      where: {
        employee_id,
        date: new Date(date)
      }
    })

    if (existingRecord) {
      return NextResponse.json({ 
        error: 'Attendance record already exists',
        message: 'An attendance record for this employee and date already exists'
      }, { status: 400 })
    }

    // Calculate hours worked if clock_in and clock_out are provided
    let hoursWorked = null
    if (clock_in && clock_out) {
      const startTime = new Date(clock_in)
      const endTime = new Date(clock_out)
      const diffMs = endTime.getTime() - startTime.getTime()
      hoursWorked = diffMs / (1000 * 60 * 60) // Convert to hours
    }

    const attendanceRecord = await prisma.attendanceRecord.create({
      data: {
        employee_id,
        date: new Date(date),
        clock_in: clock_in ? new Date(clock_in) : null,
        clock_out: clock_out ? new Date(clock_out) : null,
        hours_worked: hoursWorked,
        status: status || 'PRESENT',
        notes
      }
    })

    // Log the attendance record creation
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'CREATE',
        resource: 'attendance',
        resource_id: attendanceRecord.id,
        old_values: {},
        new_values: {
          employee_id: attendanceRecord.employee_id,
          date: attendanceRecord.date,
          status: attendanceRecord.status
        },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({
      success: true,
      data: attendanceRecord,
      message: 'Attendance record created successfully'
    })

  } catch (error) {
    console.error('Error creating attendance record:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create attendance record',
      message: 'An error occurred while creating the attendance record'
    }, { status: 500 })
  }
}
