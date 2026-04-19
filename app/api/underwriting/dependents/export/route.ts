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

    const canView = await checkPermission(session.user.role as any, 'underwriting', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const organization = searchParams.get('organization') || ''
    const status = searchParams.get('status') || ''

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { enrollee_id: { contains: search, mode: 'insensitive' } },
        { phone_number: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (organization && organization !== 'all') {
      where.organization_id = organization
    }

    if (status && status !== 'all') {
      where.status = status
    }

    const dependents = await prisma.dependent.findMany({
      where,
      include: {
        principal: {
          select: {
            first_name: true,
            last_name: true,
            enrollee_id: true
          }
        },
        organization: {
          select: {
            name: true,
            code: true
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
      'Dependent ID',
      'First Name',
      'Last Name',
      'Enrollee ID',
      'Principal Name',
      'Principal Enrollee ID',
      'Organization',
      'Organization Code',
      'Phone Number',
      'Email',
      'Date of Birth',
      'Gender',
      'Relationship',
      'Status',
      'Created By',
      'Created At'
    ]

    const csvRows = dependents.map(dependent => [
      dependent.enrollee_id,
      dependent.first_name,
      dependent.last_name,
      dependent.enrollee_id,
      dependent.principal ? `${dependent.principal.first_name} ${dependent.principal.last_name}` : '',
      dependent.principal?.enrollee_id || '',
      dependent.organization?.name || '',
      dependent.organization?.code || '',
      dependent.phone_number,
      dependent.email,
      dependent.date_of_birth ? new Date(dependent.date_of_birth).toISOString().split('T')[0] : '',
      dependent.gender,
      dependent.relationship,
      dependent.status,
      dependent.created_by ? `${dependent.created_by.first_name} ${dependent.created_by.last_name}` : '',
      dependent.created_at.toISOString()
    ])

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="dependents-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error) {
    console.error('Error exporting dependents:', error)
    return NextResponse.json(
      { error: 'Failed to export dependents' },
      { status: 500 }
    )
  }
}
