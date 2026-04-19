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

    const canView = await checkPermission(session.user.role as any, 'finance', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const startDate = searchParams.get('start_date') || ''
    const endDate = searchParams.get('end_date') || ''

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.OR = [
        { claim_number: { contains: search, mode: 'insensitive' } },
        { principal: {
          OR: [
            { first_name: { contains: search, mode: 'insensitive' } },
            { last_name: { contains: search, mode: 'insensitive' } },
            { enrollee_id: { contains: search, mode: 'insensitive' } }
          ]
        }},
        { provider: { facility_name: { contains: search, mode: 'insensitive' } } }
      ]
    }

    if (status && status !== 'all') {
      where.status = status
    }

    if (startDate || endDate) {
      where.submitted_at = {}
      if (startDate) {
        where.submitted_at.gte = new Date(startDate)
      }
      if (endDate) {
        where.submitted_at.lte = new Date(endDate)
      }
    }

    const claims = await prisma.claim.findMany({
      where,
      include: {
        principal: {
          select: {
            first_name: true,
            last_name: true,
            enrollee_id: true
          }
        },
        provider: {
          select: {
            facility_name: true,
            facility_type: true
          }
        },
        created_by: {
          select: {
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: { submitted_at: 'desc' },
    })

    // Convert to CSV format
    const csvHeaders = [
      'Claim Number',
      'Principal Name',
      'Principal Enrollee ID',
      'Provider Name',
      'Provider Type',
      'Claim Type',
      'Amount',
      'Status',
      'Submitted At',
      'Processed At',
      'Approved At',
      'Rejected At',
      'Rejection Reason',
      'Created By',
      'Created At'
    ]

    const csvRows = claims.map(claim => [
      claim.claim_number,
      claim.principal ? `${claim.principal.first_name} ${claim.principal.last_name}` : '',
      claim.principal?.enrollee_id || '',
      claim.provider?.facility_name || '',
      Array.isArray(claim.provider?.facility_type) ? claim.provider.facility_type.join(', ') : claim.provider?.facility_type || '',
      claim.claim_type,
      claim.amount.toString(),
      claim.status,
      claim.submitted_at.toISOString(),
      claim.processed_at?.toISOString() || '',
      claim.approved_at?.toISOString() || '',
      claim.rejected_at?.toISOString() || '',
      claim.rejection_reason || '',
      claim.created_by ? `${claim.created_by.first_name} ${claim.created_by.last_name}` : '',
      claim.created_at.toISOString()
    ])

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="claims-settlement-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error) {
    console.error('Error exporting claims settlement:', error)
    return NextResponse.json(
      { error: 'Failed to export claims settlement' },
      { status: 500 }
    )
  }
}
