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
    const canExport = await checkPermission(session.user.role as any, 'underwriting', 'view')
    if (!canExport) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const state = searchParams.get('state') || ''

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (status && status !== 'all') {
      where.status = status
    }

    if (state && state !== 'all') {
      where.contact_info = {
        path: ['state'],
        equals: state
      }
    }

    // Fetch organizations with principals and dependents for flattened export.
    const organizations = await prisma.organization.findMany({
      where,
      include: {
        principal_accounts: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true,
            middle_name: true,
            gender: true,
            date_of_birth: true,
            phone_number: true,
            email: true,
            residential_address: true,
            state: true,
            lga: true,
            primary_hospital: true,
            start_date: true,
            end_date: true,
            status: true
            ,
            dependents: {
              select: {
                id: true,
                dependent_id: true,
                first_name: true,
                last_name: true,
                middle_name: true,
                relationship: true,
                gender: true,
                date_of_birth: true,
                phone_number: true,
                email: true,
                residential_address: true,
                state: true,
                lga: true,
                status: true,
                created_at: true,
                updated_at: true,
              }
            }
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    const csvData: Array<Record<string, string | number>> = []

    const formatDate = (value: Date | string | null | undefined) => {
      if (!value) return ''
      const date = value instanceof Date ? value : new Date(value)
      return Number.isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0]
    }

    organizations.forEach((org) => {
      const contactInfo = (org.contact_info as any) || {}
      const contactPerson = contactInfo.contact_person || contactInfo.contactPerson || ''
      const contactNumber = contactInfo.phone_number || contactInfo.contactNumber || ''
      const contactEmail = contactInfo.email || ''
      const contactState = contactInfo.state || ''
      const contactLga = contactInfo.lga || ''
      const headOfficeAddress = contactInfo.headOfficeAddress || contactInfo.head_office_address || ''

      org.principal_accounts.forEach((principal) => {
        csvData.push({
          'Organization Name': org.name,
          'Organization Code': org.code,
          'Organization Type': org.type,
          'Organization Status': org.status,
          'Organization Contact Person': String(contactPerson),
          'Organization Contact Number': String(contactNumber),
          'Organization Email': String(contactEmail),
          'Organization State': String(contactState),
          'Organization LGA': String(contactLga),
          'Organization Address': String(headOfficeAddress),
          'Entry Type': 'PRINCIPAL',
          'Principal ID': principal.id,
          'Principal Enrollee ID': principal.enrollee_id || '',
          'Principal First Name': principal.first_name || '',
          'Principal Last Name': principal.last_name || '',
          'Principal Middle Name': principal.middle_name || '',
          'Principal Gender': principal.gender || '',
          'Principal Date of Birth': formatDate(principal.date_of_birth),
          'Principal Phone': principal.phone_number || '',
          'Principal Email': principal.email || '',
          'Principal Address': principal.residential_address || '',
          'Principal State': principal.state || '',
          'Principal LGA': principal.lga || '',
          'Principal Primary Hospital': principal.primary_hospital || '',
          'Principal Start Date': formatDate(principal.start_date),
          'Principal End Date': formatDate(principal.end_date),
          'Principal Status': principal.status,
          'Dependent ID': '',
          'Dependent Enrollee ID': '',
          'Dependent First Name': '',
          'Dependent Last Name': '',
          'Dependent Middle Name': '',
          'Dependent Relationship': '',
          'Dependent Gender': '',
          'Dependent Date of Birth': '',
          'Dependent Phone': '',
          'Dependent Email': '',
          'Dependent Address': '',
          'Dependent State': '',
          'Dependent LGA': '',
          'Dependent Status': '',
          'Dependent Created Date': '',
          'Dependent Updated Date': '',
          'Exported At': formatDate(new Date()),
        })

        principal.dependents.forEach((dependent) => {
          csvData.push({
            'Organization Name': org.name,
            'Organization Code': org.code,
            'Organization Type': org.type,
            'Organization Status': org.status,
            'Organization Contact Person': String(contactPerson),
            'Organization Contact Number': String(contactNumber),
            'Organization Email': String(contactEmail),
            'Organization State': String(contactState),
            'Organization LGA': String(contactLga),
            'Organization Address': String(headOfficeAddress),
            'Entry Type': 'DEPENDENT',
            'Principal ID': principal.id,
            'Principal Enrollee ID': principal.enrollee_id || '',
            'Principal First Name': principal.first_name || '',
            'Principal Last Name': principal.last_name || '',
            'Principal Middle Name': principal.middle_name || '',
            'Principal Gender': principal.gender || '',
            'Principal Date of Birth': formatDate(principal.date_of_birth),
            'Principal Phone': principal.phone_number || '',
            'Principal Email': principal.email || '',
            'Principal Address': principal.residential_address || '',
            'Principal State': principal.state || '',
            'Principal LGA': principal.lga || '',
            'Principal Primary Hospital': principal.primary_hospital || '',
            'Principal Start Date': formatDate(principal.start_date),
            'Principal End Date': formatDate(principal.end_date),
            'Principal Status': principal.status,
            'Dependent ID': dependent.id,
            'Dependent Enrollee ID': dependent.dependent_id || '',
            'Dependent First Name': dependent.first_name || '',
            'Dependent Last Name': dependent.last_name || '',
            'Dependent Middle Name': dependent.middle_name || '',
            'Dependent Relationship': dependent.relationship || '',
            'Dependent Gender': dependent.gender || '',
            'Dependent Date of Birth': formatDate(dependent.date_of_birth),
            'Dependent Phone': dependent.phone_number || '',
            'Dependent Email': dependent.email || '',
            'Dependent Address': dependent.residential_address || '',
            'Dependent State': dependent.state || '',
            'Dependent LGA': dependent.lga || '',
            'Dependent Status': dependent.status,
            'Dependent Created Date': formatDate(dependent.created_at),
            'Dependent Updated Date': formatDate(dependent.updated_at),
            'Exported At': formatDate(new Date()),
          })
        })
      })
    })

    const headers = [
      'Organization Name',
      'Organization Code',
      'Organization Type',
      'Organization Status',
      'Organization Contact Person',
      'Organization Contact Number',
      'Organization Email',
      'Organization State',
      'Organization LGA',
      'Organization Address',
      'Entry Type',
      'Principal ID',
      'Principal Enrollee ID',
      'Principal First Name',
      'Principal Last Name',
      'Principal Middle Name',
      'Principal Gender',
      'Principal Date of Birth',
      'Principal Phone',
      'Principal Email',
      'Principal Address',
      'Principal State',
      'Principal LGA',
      'Principal Primary Hospital',
      'Principal Start Date',
      'Principal End Date',
      'Principal Status',
      'Dependent ID',
      'Dependent Enrollee ID',
      'Dependent First Name',
      'Dependent Last Name',
      'Dependent Middle Name',
      'Dependent Relationship',
      'Dependent Gender',
      'Dependent Date of Birth',
      'Dependent Phone',
      'Dependent Email',
      'Dependent Address',
      'Dependent State',
      'Dependent LGA',
      'Dependent Status',
      'Dependent Created Date',
      'Dependent Updated Date',
      'Exported At',
    ]

    // Convert to CSV.
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => 
        headers.map(header => {
          const value = row[header as keyof typeof row]
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        }).join(',')
      )
    ].join('\n')

    // Set response headers for CSV download
    const response = new NextResponse(csvContent)
    response.headers.set('Content-Type', 'text/csv')
    response.headers.set('Content-Disposition', `attachment; filename="organizations-export-${new Date().toISOString().split('T')[0]}.csv"`)
    
    return response

  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to export organizations',
      message: 'An error occurred while exporting organizations data'
    }, { status: 500 })
  }
}
