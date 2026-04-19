import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const departments = await prisma.department.findMany({
      include: {
        users: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(departments)
  } catch (error) {
    console.error('Error fetching departments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch departments' },
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

    const { name, description } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 })
    }

    // Check if department already exists
    const existingDepartment = await prisma.department.findUnique({
      where: { name }
    })

    if (existingDepartment) {
      return NextResponse.json({ error: 'Department already exists' }, { status: 400 })
    }

    const department = await prisma.department.create({
      data: {
        name,
        description
      }
    })

    // Log the department creation
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'CREATE',
        resource: 'departments',
        resource_id: department.id,
        old_values: {},
        new_values: {
          name: department.name,
          description: department.description
        },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({
      success: true,
      data: department,
      message: 'Department created successfully'
    })

  } catch (error) {
    console.error('Error creating department:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create department',
      message: 'An error occurred while creating the department'
    }, { status: 500 })
  }
}
