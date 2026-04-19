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
      where.pay_period_start = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    } else if (startDate) {
      where.pay_period_start = { gte: new Date(startDate) }
    } else if (endDate) {
      where.pay_period_start = { lte: new Date(endDate) }
    }

    // Get total count for pagination
    const total = await prisma.payroll.count({ where })

    // Get payroll records with pagination
    const payroll = await prisma.payroll.findMany({
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
      payroll,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    })

  } catch (error) {
    console.error('Error fetching payroll records:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payroll records' },
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
      pay_period_start,
      pay_period_end,
      basic_salary,
      allowances,
      deductions,
      overtime_pay,
      payment_date
    } = await request.json()

    // Validate required fields
    if (!employee_id || !basic_salary) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        message: 'Employee ID and basic salary are required'
      }, { status: 400 })
    }

    // Calculate net salary
    const allowancesAmount = allowances || 0
    const deductionsAmount = deductions || 0
    const overtimeAmount = overtime_pay || 0
    const netSalary = Number(basic_salary) + allowancesAmount - deductionsAmount + overtimeAmount

    const payroll = await prisma.payroll.create({
      data: {
        employee_id,
        pay_period_start: pay_period_start ? new Date(pay_period_start) : new Date(),
        pay_period_end: pay_period_end ? new Date(pay_period_end) : new Date(),
        basic_salary: Number(basic_salary),
        allowances: allowancesAmount,
        deductions: deductionsAmount,
        overtime_pay: overtimeAmount,
        net_salary: netSalary,
        status: 'PENDING',
        payment_date: payment_date ? new Date(payment_date) : null
      }
    })

    // Log the payroll creation
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'CREATE',
        resource: 'payroll',
        resource_id: payroll.id,
        old_values: {},
        new_values: {
          employee_id: payroll.employee_id,
          basic_salary: payroll.basic_salary,
          net_salary: payroll.net_salary,
          status: payroll.status
        },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({
      success: true,
      data: payroll,
      message: 'Payroll record created successfully'
    })

  } catch (error) {
    console.error('Error creating payroll record:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create payroll record',
      message: 'An error occurred while creating the payroll record'
    }, { status: 500 })
  }
}
