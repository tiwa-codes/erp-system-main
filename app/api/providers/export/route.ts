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

    const canView = await checkPermission(session.user.role as any, 'provider', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const facilityType = searchParams.get('facility_type') || ''
    const status = searchParams.get('status') || ''

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.OR = [
        { facility_name: { contains: search, mode: 'insensitive' } },
        { facility_code: { contains: search, mode: 'insensitive' } },
        { contact_person: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone_number: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (facilityType && facilityType !== 'all') {
      where.facility_type = {
        has: facilityType
      }
    }

    if (status && status !== 'all') {
      where.status = status
    }

    const providers = await prisma.provider.findMany({
      where,
      include: {
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
      'Provider ID',
      'Facility Name',
      'Facility Code',
      'Facility Type',
      'Contact Person',
      'Email',
      'Phone Number',
      'Address',
      'City',
      'State',
      'Status',
      'Registration Date',
      'Selected Bands',
      'Created By',
      'Created At'
    ]

    const csvRows = providers.map(provider => [
      provider.id,
      provider.facility_name,
      provider.facility_code,
      Array.isArray(provider.facility_type) ? provider.facility_type.join(', ') : provider.facility_type,
      provider.contact_person,
      provider.email,
      provider.phone_number,
      provider.address,
      provider.city,
      provider.state,
      provider.status,
      provider.date ? new Date(provider.date).toISOString().split('T')[0] : '',
      Array.isArray(provider.selected_bands) ? provider.selected_bands.join(', ') : provider.selected_bands,
      provider.created_by ? `${provider.created_by.first_name} ${provider.created_by.last_name}` : '',
      provider.created_at.toISOString()
    ])

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="providers-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error) {
    console.error('Error exporting providers:', error)
    return NextResponse.json(
      { error: 'Failed to export providers' },
      { status: 500 }
    )
  }
}
