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

    const canViewProviders = await checkPermission(session.user.role as any, 'provider', 'view')
    if (!canViewProviders) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const provider = searchParams.get('provider') || ''
    const status = searchParams.get('status') || ''

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.patient_id = { contains: search, mode: 'insensitive' }
    }

    if (provider && provider !== 'all') {
      where.provider_id = provider
    }

    if (status && status !== 'all') {
      where.status = status
    }

    // Only show in-patients who have admission_required = true in their approval codes
    where.OR = [
      {
        // Check if there's an approval code with admission_required = true for this patient
        patient_id: {
          in: await prisma.approvalCode.findMany({
            where: { admission_required: true },
            select: { enrollee_id: true }
          }).then(codes => codes.map(code => code.enrollee_id))
        }
      }
    ]

    const [in_patients, total] = await Promise.all([
      prisma.inPatient.findMany({
        where,
        include: {
          provider: {
            select: {
              id: true,
              facility_name: true,
              facility_type: true
            }
          }
        },
        orderBy: { admission_date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.inPatient.count({ where })
    ])

    return NextResponse.json({
      in_patients,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching in-patients:', error)
    return NextResponse.json(
      { error: 'Failed to fetch in-patients' },
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

    const canAddProviders = await checkPermission(session.user.role as any, 'provider', 'add')
    if (!canAddProviders) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      patient_id,
      provider_id,
      admission_date,
      discharge_date,
      diagnosis,
      treatment,
      status
    } = body

    if (!patient_id || !provider_id || !admission_date) {
      return NextResponse.json({ error: 'Patient ID, provider ID, and admission date are required' }, { status: 400 })
    }

    // Verify provider exists
    const provider = await prisma.provider.findUnique({
      where: { id: provider_id }
    })

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    const inPatient = await prisma.inPatient.create({
      data: {
        patient_id,
        provider_id,
        admission_date: new Date(admission_date),
        discharge_date: discharge_date ? new Date(discharge_date) : null,
        diagnosis,
        treatment,
        status: status || 'ADMITTED'
      }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'INPATIENT_CREATE',
        resource: 'inpatient',
        resource_id: inPatient.id,
        new_values: {
          patient_id,
          provider_id,
          admission_date,
          discharge_date,
          diagnosis,
          treatment,
          status
        },
      },
    })

    return NextResponse.json(inPatient, { status: 201 })
  } catch (error) {
    console.error('Error creating in-patient record:', error)
    return NextResponse.json(
      { error: 'Failed to create in-patient record' },
      { status: 500 }
    )
  }
}
