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

    // Get recent employee records
    const recentEmployees = await prisma.employee.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      include: {
        department: true
      }
    })

    const employeeRecords = recentEmployees.map(emp => ({
      date: emp.created_at.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      }) + ' ' + emp.created_at.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      name: `${emp.first_name} ${emp.last_name}`
    }))

    // Get recent attendance records
    const recentAttendance = await prisma.attendanceRecord.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      include: {
        employee: true
      }
    })

    const attendance = recentAttendance.map(att => ({
      time: att.created_at.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      name: `${att.employee.first_name} ${att.employee.last_name}`
    }))

    // Get recent leave requests
    const recentLeave = await prisma.leaveRequest.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      include: {
        employee: true
      }
    })

    const leave = recentLeave.map(l => ({
      type: l.leave_type,
      date: l.start_date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      })
    }))

    // Get recent payroll records
    const recentPayroll = await prisma.payroll.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      include: {
        employee: true
      }
    })

    const payroll = recentPayroll.map(p => ({
      amount: p.net_salary.toString()
    }))

    return NextResponse.json({
      employeeRecords,
      attendance,
      leave,
      payroll
    })

  } catch (error) {
    console.error('Error fetching recent activities:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recent activities' },
      { status: 500 }
    )
  }
}
