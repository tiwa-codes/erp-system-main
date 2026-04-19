import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hashPassword, generateRandomPassword } from '@/lib/auth-utils'
import { checkPermission } from '@/lib/permissions'
import { notificationService } from '@/lib/notifications'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to view users
    const canView = await checkPermission(session.user.role as any, 'users', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const role = searchParams.get('role')
    const excludeRole = searchParams.get('excludeRole')
    const status = searchParams.get('status')
    const department = searchParams.get('department')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const where: any = {}
    
    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone_number: { contains: search, mode: 'insensitive' } },
      ]
    }
    
    if (role && role !== 'all') {
      where.role = { name: role.toUpperCase() }
    } else if (excludeRole) {
      where.role = { name: { not: excludeRole.toUpperCase() } }
    }
    if (status && status !== 'all') where.status = status.toUpperCase()
    if (department && department !== 'all') where.department = department

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          department: true,
          provider: true,
          role: true,
          client_account: {
            include: {
              organization: {
                select: {
                  name: true,
                },
              },
            },
          },
        }
      }),
      prisma.user.count({ where })
    ])

    return NextResponse.json({
      users: users.map(user => ({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        phone_number: user.phone_number,
        title: user.title,
        date_of_birth: user.date_of_birth,
        gender: user.gender,
        contact_address: user.contact_address,
        role: user.role?.name || 'N/A',
        department_id: user.department_id,
        department: user.department?.name || 'N/A',
        provider_id: user.provider_id,
        provider: user.provider?.facility_name || user.client_account?.organization?.name || 'N/A',
        status: user.status,
        created_at: user.created_at,
        updated_at: user.updated_at
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to add users
    const canAdd = await checkPermission(session.user.role as any, 'users', 'add')
    if (!canAdd) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      email,
      firstName,
      lastName,
      title,
      dateOfBirth,
      gender,
      phoneNumber,
      contactAddress,
      role,
      departmentId,
      providerId,
      status,
    } = body

    // Validate required fields
    if (!email || !firstName || !lastName || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Find the role by name
    const roleRecord = await prisma.role.findFirst({
      where: { name: role }
    })
    
    if (!roleRecord) {
      return NextResponse.json({ error: 'Invalid role specified' }, { status: 400 })
    }

    // Validate provider selection for PROVIDER role
    if (role === 'PROVIDER' && !providerId) {
      return NextResponse.json({ error: 'Provider selection is required for PROVIDER role' }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 })
    }

    // Generate a random password for the user
    const tempPassword = generateRandomPassword()
    const hashedPassword = await hashPassword(tempPassword)

    const userData = {
      email,
      first_name: firstName,
      last_name: lastName,
      title,
      date_of_birth: dateOfBirth ? new Date(dateOfBirth) : null,
      gender,
      phone_number: phoneNumber,
      contact_address: contactAddress,
      role_id: roleRecord.id,
      status: (status as any) || 'ACTIVE',
      department_id: departmentId || null,
      provider_id: providerId || null,
      password: hashedPassword,
    }
    
    const user = await prisma.user.create({
      data: userData,
      include: {
        department: true,
        provider: true,
        role: true
      }
    })
    
    // Send user details via email
    try {
      console.log('User created successfully:', user.id)
      await notificationService.sendWelcomeEmail(
        email,
        `${firstName} ${lastName}`,
        role,
        tempPassword
      )
      console.log('Welcome email sent successfully')
    } catch (emailError) {
      console.error('Email sending failed:', emailError)
      // Don't fail user creation if email fails
    }

    return NextResponse.json({
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      role: user.role?.name || 'N/A',
      department: user.department?.name || 'N/A',
      provider: user.provider?.facility_name || 'N/A',
      phone: user.phone_number,
      status: user.status
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
