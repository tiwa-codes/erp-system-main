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

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const department = searchParams.get('department') || ''
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Check permission
    const canView = await checkPermission(session.user.role as any, 'hr', 'view')

    // Allow restricted access for dropdowns (high limit) even without hr:view
    const isDropdownRequest = limit >= 1000

    if (!canView && !isDropdownRequest) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Build where clause
    const where: any = {}

    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employee_id: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (department && department !== 'all') {
      where.department_id = department
    }

    if (status && status !== 'all') {
      where.status = status
    }

    // Get total count for pagination
    const total = await prisma.employee.count({ where })

    // Determine fields to select based on permission
    const selectFields = canView ? {
      id: true,
      employee_id: true,
      first_name: true,
      last_name: true,
      email: true,
      phone_number: true,
      position: true,
      status: true,
      employment_type: true,
      hire_date: true,
      salary: true,
      gender: true,
      role: true,
      address: true,
      title: true,
      department_id: true,
      emergency_contact_name: true,
      emergency_contact_phone: true,
      emergency_contact_relationship: true,
      uploadedFileUrls: true,
      created_at: true,
      updated_at: true,
      department: {
        select: {
          id: true,
          name: true
        }
      }
    } : {
      // Restricted fields for dropdown
      id: true,
      employee_id: true,
      first_name: true,
      last_name: true,
      email: true,
      department: {
        select: {
          id: true,
          name: true
        }
      }
    }

    // Get employees with pagination
    const employees = await prisma.employee.findMany({
      where,
      select: selectFields,
      orderBy: {
        created_at: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    })

    const pages = Math.ceil(total / limit)

    return NextResponse.json({
      employees,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    })

  } catch (error) {
    console.error('Error fetching employees:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
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
      first_name,
      last_name,
      email,
      phone,
      address,
      title,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relationship,
      position,
      department_id,
      hire_date,
      salary,
      gender,
      employment_type,
      status,
      role,
      uploadedFileUrls
    } = await request.json()

    // Validate required fields
    if (!first_name || !last_name || !email || !position || !department_id) {
      return NextResponse.json({
        error: 'Missing required fields',
        message: 'First name, last name, email, position, and department are required'
      }, { status: 400 })
    }

    // Check if employee ID already exists
    if (employee_id) {
      const existingEmployee = await prisma.employee.findUnique({
        where: { employee_id }
      })

      if (existingEmployee) {
        return NextResponse.json({
          error: 'Employee ID already exists',
          message: 'An employee with this ID already exists'
        }, { status: 400 })
      }
    }

    // Check if email already exists
    const existingEmail = await prisma.employee.findUnique({
      where: { email }
    })

    if (existingEmail) {
      return NextResponse.json({
        error: 'Email already exists',
        message: 'An employee with this email already exists'
      }, { status: 400 })
    }

    // Generate employee ID if not provided
    const finalEmployeeId = employee_id || `EMP-${Date.now()}`

    const employee = await prisma.employee.create({
      data: {
        employee_id: finalEmployeeId,
        first_name,
        last_name,
        email,
        phone_number: phone,
        address,
        title,
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relationship,
        position,
        department_id,
        hire_date: hire_date ? new Date(hire_date) : new Date(),
        salary: salary ? parseFloat(salary) : null,
        gender,
        employment_type: employment_type || 'FULL_TIME',
        status: status || 'ACTIVE',
        role,
        uploadedFileUrls: uploadedFileUrls,
        created_by_id: session.user.id
      }
    })

    // Log the employee creation
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'CREATE',
        resource: 'employees',
        resource_id: employee.id,
        old_values: {},
        new_values: {
          employee_id: employee.employee_id,
          first_name: employee.first_name,
          last_name: employee.last_name,
          email: employee.email,
          position: employee.position,
          department_id: employee.department_id
        },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({
      success: true,
      data: employee,
      message: 'Employee created successfully'
    })

  } catch (error) {
    console.error('Error creating employee:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create employee',
      message: 'An error occurred while creating the employee'
    }, { status: 500 })
  }
}

