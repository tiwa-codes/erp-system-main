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
    const status = searchParams.get('status') || ''

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { employee_id: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone_number: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (department && department !== 'all') {
      where.department_id = department
    }

    if (status && status !== 'all') {
      where.status = status
    }

    const employees = await prisma.employee.findMany({
      where,
      include: {
        department: {
          select: {
            name: true
          }
        },
        created_by: {
          select: {
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
    })

    // Convert to CSV format
    const csvHeaders = [
      'Employee ID',
      'First Name',
      'Last Name',
      'Email',
      'Phone Number',
      'Department',
      'Position',
      'Status',
      'Hire Date',
      'Date of Birth',
      'Salary',
      'Address',
      'Created By',
      'Created At'
    ]

    const csvRows = employees.map(employee => [
      employee.employee_id,
      employee.first_name,
      employee.last_name,
      employee.email,
      employee.phone_number,
      employee.department?.name || '',
      employee.position,
      employee.status,
      employee.hire_date ? new Date(employee.hire_date).toISOString().split('T')[0] : '',
      employee.date_of_birth ? new Date(employee.date_of_birth).toISOString().split('T')[0] : '',
      employee.salary?.toString() || '',
      employee.address,
      employee.created_by ? `${employee.created_by.first_name} ${employee.created_by.last_name}` : '',
      employee.created_at.toISOString()
    ])

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="employees-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error) {
    console.error('Error exporting employees:', error)
    return NextResponse.json(
      { error: 'Failed to export employees' },
      { status: 500 }
    )
  }
}
