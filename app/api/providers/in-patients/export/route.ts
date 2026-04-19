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
    const status = searchParams.get('status') || ''

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.OR = [
        { patient_name: { contains: search, mode: 'insensitive' } },
        { patient_id: { contains: search, mode: 'insensitive' } },
        { admission_number: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (provider && provider !== 'all') {
      where.provider_id = provider
    }

    if (status && status !== 'all') {
      where.status = status
    }

    const inPatients = await prisma.inPatient.findMany({
      where,
      include: {
        provider: {
          select: {
            facility_name: true,
            facility_code: true
          }
        },
        created_by: {
          select: {
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: { admission_date: 'desc' },
    })

    // Convert to CSV format
    const csvHeaders = [
      'Patient Name',
      'Patient ID',
      'Admission Number',
      'Provider Name',
      'Provider Code',
      'Admission Date',
      'Discharge Date',
      'Diagnosis',
      'Treatment',
      'Status',
      'Room Number',
      'Bed Number',
      'Created By',
      'Created At'
    ]

    const csvRows = inPatients.map(patient => [
      patient.patient_name,
      patient.patient_id,
      patient.admission_number,
      patient.provider?.facility_name || '',
      patient.provider?.facility_code || '',
      patient.admission_date ? new Date(patient.admission_date).toISOString().split('T')[0] : '',
      patient.discharge_date ? new Date(patient.discharge_date).toISOString().split('T')[0] : '',
      patient.diagnosis,
      patient.treatment,
      patient.status,
      patient.room_number || '',
      patient.bed_number || '',
      patient.created_by ? `${patient.created_by.first_name} ${patient.created_by.last_name}` : '',
      patient.created_at.toISOString()
    ])

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="in-patients-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error) {
    console.error('Error exporting in-patients:', error)
    return NextResponse.json(
      { error: 'Failed to export in-patients' },
      { status: 500 }
    )
  }
}
