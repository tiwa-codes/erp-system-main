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
    const department = searchParams.get('department')
    const type = searchParams.get('type')
    const date = searchParams.get('date')

    // Build where clause for filtering
    const where: any = {}
    if (department && department !== 'all') {
      where.department_id = department
    }
    if (type && type !== 'all') {
      where.position = type
    }

    // Get total employees
    const totalEmployees = await prisma.employee.count({ where })

    // Get active leave requests
    const activeLeave = await prisma.leaveRequest.count({
      where: {
        status: 'APPROVED',
        start_date: { lte: new Date() },
        end_date: { gte: new Date() }
      }
    })

    // Get inactive employees
    const inactiveEmployees = await prisma.employee.count({
      where: { ...where, status: 'INACTIVE' }
    })

    // Get total payroll for current month
    const currentDate = new Date()
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

    const payrollData = await prisma.payroll.aggregate({
      where: {
        pay_period_start: { gte: startOfMonth },
        pay_period_end: { lte: endOfMonth },
        status: 'PAID'
      },
      _sum: {
        net_salary: true
      }
    })

    const totalPayroll = payrollData._sum.net_salary || 0

    // Calculate growth percentages (mock data for now)
    const employeeGrowth = Math.floor(Math.random() * 10) + 1
    const leaveGrowth = Math.floor(Math.random() * 5) + 1

    return NextResponse.json({
      totalEmployees,
      activeLeave,
      inactiveEmployees,
      totalPayroll: totalPayroll.toString(),
      employeeGrowth,
      leaveGrowth
    })

  } catch (error) {
    console.error('Error fetching HR metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch HR metrics' },
      { status: 500 }
    )
  }
}
