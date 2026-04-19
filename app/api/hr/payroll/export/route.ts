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

    const canView = await checkPermission(session.user.role as any, 'hr', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const department = searchParams.get('department') || ''
    const month = searchParams.get('month') || ''
    const year = searchParams.get('year') || ''

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.employee = {
        OR: [
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
          { employee_id: { contains: search, mode: 'insensitive' } }
        ]
      }
    }

    if (department && department !== 'all') {
      where.employee = {
        ...where.employee,
        department_id: department
      }
    }

    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
      const endDate = new Date(parseInt(year), parseInt(month), 0)
      where.pay_period_start = {
        gte: startDate,
        lte: endDate
      }
    }

    const payrolls = await prisma.payroll.findMany({
      where,
      include: {
        employee: {
          select: {
            employee_id: true,
            first_name: true,
            last_name: true,
            email: true,
            department: {
              select: {
                name: true
              }
            }
          }
        },
        created_by: {
          select: {
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: { pay_period_start: 'desc' },
    })

    // Convert to CSV format
    const csvHeaders = [
      'Employee ID',
      'Employee Name',
      'Email',
      'Department',
      'Pay Period Start',
      'Pay Period End',
      'Basic Salary',
      'Allowances',
      'Deductions',
      'Net Pay',
      'Status',
      'Payment Date',
      'Created By',
      'Created At'
    ]

    const csvRows = payrolls.map(payroll => [
      payroll.employee.employee_id,
      `${payroll.employee.first_name} ${payroll.employee.last_name}`,
      payroll.employee.email,
      payroll.employee.department?.name || '',
      payroll.pay_period_start.toISOString().split('T')[0],
      payroll.pay_period_end.toISOString().split('T')[0],
      payroll.basic_salary.toString(),
      payroll.allowances.toString(),
      payroll.deductions.toString(),
      payroll.net_pay.toString(),
      payroll.status,
      payroll.payment_date ? payroll.payment_date.toISOString().split('T')[0] : '',
      payroll.created_by ? `${payroll.created_by.first_name} ${payroll.created_by.last_name}` : '',
      payroll.created_at.toISOString()
    ])

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="payroll-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error) {
    console.error('Error exporting payroll:', error)
    return NextResponse.json(
      { error: 'Failed to export payroll' },
      { status: 500 }
    )
  }
}
