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
    const provider = searchParams.get('provider') || ''
    const riskLevel = searchParams.get('risk_level') || ''

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.provider = {
        OR: [
          { facility_name: { contains: search, mode: 'insensitive' } },
          { facility_code: { contains: search, mode: 'insensitive' } }
        ]
      }
    }

    if (provider && provider !== 'all') {
      where.provider_id = provider
    }

    if (riskLevel && riskLevel !== 'all') {
      where.risk_level = riskLevel
    }

    const riskProfiles = await prisma.providerRiskProfile.findMany({
      where,
      include: {
        provider: {
          select: {
            facility_name: true,
            facility_code: true,
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
      orderBy: { created_at: 'desc' },
    })

    // Convert to CSV format
    const csvHeaders = [
      'Provider Name',
      'Provider Code',
      'Provider Type',
      'Risk Level',
      'Risk Score',
      'Assessment Date',
      'Risk Factors',
      'Mitigation Actions',
      'Status',
      'Created By',
      'Created At'
    ]

    const csvRows = riskProfiles.map(profile => [
      profile.provider?.facility_name || '',
      profile.provider?.facility_code || '',
      Array.isArray(profile.provider?.facility_type) ? profile.provider.facility_type.join(', ') : profile.provider?.facility_type || '',
      profile.risk_level,
      profile.risk_score?.toString() || '',
      profile.assessment_date ? new Date(profile.assessment_date).toISOString().split('T')[0] : '',
      profile.risk_factors || '',
      profile.mitigation_actions || '',
      profile.status,
      profile.created_by ? `${profile.created_by.first_name} ${profile.created_by.last_name}` : '',
      profile.created_at.toISOString()
    ])

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="provider-risk-profiles-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error) {
    console.error('Error exporting provider risk profiles:', error)
    return NextResponse.json(
      { error: 'Failed to export provider risk profiles' },
      { status: 500 }
    )
  }
}
