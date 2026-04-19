import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

// GET - Fetch existing clinical encounter for an appointment
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has telemedicine permissions
    const hasPermission = await checkPermission(session.user.role as any, "telemedicine", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = params

    // Fetch the most recent clinical encounter for this appointment
    const clinicalEncounter = await prisma.clinicalEncounter.findFirst({
      where: { appointment_id: id },
      orderBy: { created_at: "desc" },
      include: {
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      clinical_encounter: clinicalEncounter
    })

  } catch (error) {
    console.error("Error fetching clinical encounter:", error)
    return NextResponse.json(
      { error: "Failed to fetch clinical encounter" },
      { status: 500 }
    )
  }
}

// POST - Create or update clinical encounter
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has telemedicine permissions
    const hasPermission = await checkPermission(session.user.role as any, "telemedicine", "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const {
      presenting_complaints,
      clinical_notes,
      assessment,
      diagnosis,
      plan_notes,
      status,
      encounter_id
    } = body

    // Verify appointment exists
    const appointment = await prisma.telemedicineAppointment.findUnique({
      where: { id }
    })

    if (!appointment) {
      return NextResponse.json({ 
        error: "Appointment not found" 
      }, { status: 404 })
    }

    let clinicalEncounter

    // If encounter_id is provided, update existing encounter
    if (encounter_id) {
      clinicalEncounter = await prisma.clinicalEncounter.update({
        where: { id: encounter_id },
        data: {
          presenting_complaints: presenting_complaints || null,
          clinical_notes: clinical_notes || null,
          assessment: assessment || null,
          diagnosis: diagnosis || null,
          plan_notes: plan_notes || null,
          status: status || 'IN_PROGRESS',
          updated_at: new Date()
        }
      })

      // Create audit log for update
      await prisma.auditLog.create({
        data: {
          user_id: session.user.id,
          action: "CLINICAL_ENCOUNTER_UPDATE",
          resource: "clinical_encounter",
          resource_id: clinicalEncounter.id,
          new_values: clinicalEncounter
        }
      })
    } else {
      // Create new clinical encounter
      clinicalEncounter = await prisma.clinicalEncounter.create({
        data: {
          appointment_id: id,
          presenting_complaints: presenting_complaints || null,
          clinical_notes: clinical_notes || null,
          assessment: assessment || null,
          diagnosis: diagnosis || null,
          plan_notes: plan_notes || null,
          status: status || 'IN_PROGRESS',
          created_by_id: session.user.id
        }
      })

      // Create audit log for creation
      await prisma.auditLog.create({
        data: {
          user_id: session.user.id,
          action: "CLINICAL_ENCOUNTER_CREATE",
          resource: "clinical_encounter",
          resource_id: clinicalEncounter.id,
          new_values: clinicalEncounter
        }
      })
    }

    // Update appointment status based on encounter status
    if (status === 'COMPLETED' && appointment.status !== 'COMPLETED') {
      await prisma.telemedicineAppointment.update({
        where: { id },
        data: { status: 'COMPLETED' }
      })
    } else if (status === 'IN_PROGRESS' && appointment.status === 'SCHEDULED') {
      await prisma.telemedicineAppointment.update({
        where: { id },
        data: { status: 'IN_PROGRESS' }
      })
    }

    return NextResponse.json({
      success: true,
      clinical_encounter: clinicalEncounter,
      message: encounter_id 
        ? `Clinical encounter ${status === 'COMPLETED' ? 'completed' : 'saved as in-progress'}` 
        : `Clinical encounter created as ${status || 'in-progress'}`
    }, { status: encounter_id ? 200 : 201 })

  } catch (error) {
    console.error("Error saving clinical encounter:", error)
    return NextResponse.json(
      { error: "Failed to save clinical encounter" },
      { status: 500 }
    )
  }
}
