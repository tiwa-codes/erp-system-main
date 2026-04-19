import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0]
}

function csvEscape(value: unknown): string {
  const stringValue = value === null || value === undefined ? '' : String(value)
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canExport = await checkPermission(session.user.role as any, 'underwriting', 'view')
    if (!canExport) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const organization = await prisma.organization.findUnique({
      where: { id: params.id },
      include: {
        principal_accounts: {
          include: {
            dependents: true,
            plan: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            enrollee_id: 'asc',
          },
        },
      },
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const headers = [
      'Organization Name',
      'Organization Code',
      'Entry Type',
      'Principal Enrollee ID',
      'Dependent Enrollee ID',
      'Enrollee ID',
      'First Name',
      'Last Name',
      'Middle Name',
      'Relationship',
      'Gender',
      'Date of Birth',
      'Phone',
      'Email',
      'Address',
      'State',
      'LGA',
      'Plan',
      'Primary Hospital',
      'Status',
      'Created Date',
      'Updated Date',
    ]

    const rows: Array<Record<string, string>> = []

    for (const principal of organization.principal_accounts) {
      rows.push({
        'Organization Name': organization.name,
        'Organization Code': organization.code,
        'Entry Type': 'PRINCIPAL',
        'Principal Enrollee ID': principal.enrollee_id || '',
        'Dependent Enrollee ID': '',
        'Enrollee ID': principal.enrollee_id || '',
        'First Name': principal.first_name || '',
        'Last Name': principal.last_name || '',
        'Middle Name': principal.middle_name || '',
        'Relationship': '',
        'Gender': principal.gender || '',
        'Date of Birth': formatDate(principal.date_of_birth),
        'Phone': principal.phone_number || '',
        'Email': principal.email || '',
        'Address': principal.residential_address || '',
        'State': principal.state || '',
        'LGA': principal.lga || '',
        'Plan': principal.plan?.name || '',
        'Primary Hospital': principal.primary_hospital || '',
        'Status': principal.status || '',
        'Created Date': formatDate(principal.created_at),
        'Updated Date': formatDate(principal.updated_at),
      })

      const sortedDependents = [...(principal.dependents || [])].sort((a, b) => {
        const aId = a.dependent_id || ''
        const bId = b.dependent_id || ''
        return aId.localeCompare(bId, undefined, { numeric: true, sensitivity: 'base' })
      })

      for (const dependent of sortedDependents) {
        rows.push({
          'Organization Name': organization.name,
          'Organization Code': organization.code,
          'Entry Type': 'DEPENDENT',
          'Principal Enrollee ID': principal.enrollee_id || '',
          'Dependent Enrollee ID': dependent.dependent_id || '',
          'Enrollee ID': dependent.dependent_id || '',
          'First Name': dependent.first_name || '',
          'Last Name': dependent.last_name || '',
          'Middle Name': dependent.middle_name || '',
          'Relationship': dependent.relationship || '',
          'Gender': dependent.gender || '',
          'Date of Birth': formatDate(dependent.date_of_birth),
          'Phone': dependent.phone_number || '',
          'Email': dependent.email || '',
          'Address': dependent.residential_address || '',
          'State': dependent.state || '',
          'LGA': dependent.lga || '',
          'Plan': principal.plan?.name || '',
          'Primary Hospital': principal.primary_hospital || '',
          'Status': dependent.status || '',
          'Created Date': formatDate(dependent.created_at),
          'Updated Date': formatDate(dependent.updated_at),
        })
      }
    }

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => headers.map((header) => csvEscape(row[header] || '')).join(',')),
    ].join('\n')

    const response = new NextResponse(csvContent)
    response.headers.set('Content-Type', 'text/csv')
    response.headers.set(
      'Content-Disposition',
      `attachment; filename="organization-${organization.code || organization.name}-enrollees-${new Date().toISOString().split('T')[0]}.csv"`
    )

    return response
  } catch (error) {
    console.error('Organization export error:', error)
    return NextResponse.json({ error: 'Failed to export organization enrollees' }, { status: 500 })
  }
}
