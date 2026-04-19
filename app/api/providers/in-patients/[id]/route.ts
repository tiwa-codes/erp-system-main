import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canViewProviders = await checkPermission(session.user.role as any, 'provider', 'view')
    if (!canViewProviders) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const inPatient = await prisma.inPatient.findUnique({
      where: { id: params.id },
      include: {
        provider: {
          select: {
            id: true,
            facility_name: true,
            facility_type: true
          }
        }
      }
    })

    if (!inPatient) {
      return NextResponse.json({ error: 'In-patient record not found' }, { status: 404 })
    }

    return NextResponse.json(inPatient)
  } catch (error) {
    console.error('Error fetching in-patient:', error)
    return NextResponse.json(
      { error: 'Failed to fetch in-patient record' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canEditProviders = await checkPermission(session.user.role as any, 'provider', 'edit')
    if (!canEditProviders) {
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

    const existingInPatient = await prisma.inPatient.findUnique({
      where: { id: params.id }
    })

    if (!existingInPatient) {
      return NextResponse.json({ error: 'In-patient record not found' }, { status: 404 })
    }

    const updatedInPatient = await prisma.inPatient.update({
      where: { id: params.id },
      data: {
        patient_id,
        provider_id,
        admission_date: admission_date ? new Date(admission_date) : undefined,
        discharge_date: discharge_date ? new Date(discharge_date) : null,
        diagnosis,
        treatment,
        status
      }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'INPATIENT_UPDATE',
        resource: 'inpatient',
        resource_id: params.id,
        old_values: existingInPatient,
        new_values: updatedInPatient,
      },
    })

    return NextResponse.json(updatedInPatient)
  } catch (error) {
    console.error('Error updating in-patient:', error)
    return NextResponse.json(
      { error: 'Failed to update in-patient record' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canDeleteProviders = await checkPermission(session.user.role as any, 'provider', 'delete')
    if (!canDeleteProviders) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existingInPatient = await prisma.inPatient.findUnique({
      where: { id: params.id }
    })

    if (!existingInPatient) {
      return NextResponse.json({ error: 'In-patient record not found' }, { status: 404 })
    }

    await prisma.inPatient.delete({
      where: { id: params.id }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'INPATIENT_DELETE',
        resource: 'inpatient',
        resource_id: params.id,
        old_values: existingInPatient,
      },
    })

    return NextResponse.json({ message: 'In-patient record deleted successfully' })
  } catch (error) {
    console.error('Error deleting in-patient:', error)
    return NextResponse.json(
      { error: 'Failed to delete in-patient record' },
      { status: 500 }
    )
  }
}
