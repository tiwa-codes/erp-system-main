import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { resolveTelemedicinePatient } from "@/lib/telemedicine"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission
    const hasPermission = await checkPermission(session.user.role as any, "telemedicine", "add")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const patientId = params.id
    const { enrolleeId: appointmentEnrolleeId, dependent } = await resolveTelemedicinePatient(patientId)
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

    const latestAppointment = await prisma.telemedicineAppointment.findFirst({
      where: {
        enrollee_id: appointmentEnrolleeId,
        dependent_id: dependent ? dependent.id : null
      },
      orderBy: {
        created_at: "desc"
      }
    })

    if (!latestAppointment) {
      return NextResponse.json(
        { error: "No appointment found for this patient" },
        { status: 404 }
      )
    }

    let clinicalEncounter
    const finalStatus = status || 'IN_PROGRESS'

    // If encounter_id is provided, update existing encounter
    if (encounter_id) {
      // Verify the encounter exists and belongs to the appointment
      const existingEncounter = await prisma.clinicalEncounter.findFirst({
        where: {
          id: encounter_id,
          appointment_id: latestAppointment.id
        }
      })

      if (!existingEncounter) {
        return NextResponse.json(
          { error: "Clinical encounter not found or does not belong to this appointment" },
          { status: 404 }
        )
      }

      // Update existing encounter
      clinicalEncounter = await prisma.clinicalEncounter.update({
        where: { id: encounter_id },
        data: {
          presenting_complaints: presenting_complaints || null,
          clinical_notes: clinical_notes || null,
          assessment: assessment || null,
          diagnosis: diagnosis || null,
          plan_notes: plan_notes || null,
          status: finalStatus,
          updated_at: new Date()
        },
        include: {
          created_by: {
            select: {
              first_name: true,
              last_name: true
            }
          }
        }
      })

      // Log audit trail for update
      await createAuditLog({
        userId: session.user.id,
        action: "UPDATE",
        resource: "ClinicalEncounter",
        resourceId: clinicalEncounter.id,
        newValues: {
          patient_id: patientId,
          appointment_id: latestAppointment.id,
          presenting_complaints,
          clinical_notes,
          assessment,
          diagnosis,
          plan_notes,
          status: finalStatus
        }
      })
    } else {
      // Check if there's an existing IN_PROGRESS encounter for this appointment
      const existingInProgressEncounter = await prisma.clinicalEncounter.findFirst({
        where: {
          appointment_id: latestAppointment.id,
          status: 'IN_PROGRESS'
        },
        orderBy: {
          created_at: 'desc'
        }
      })

      if (existingInProgressEncounter) {
        // Update the existing IN_PROGRESS encounter
        clinicalEncounter = await prisma.clinicalEncounter.update({
          where: { id: existingInProgressEncounter.id },
          data: {
            presenting_complaints: presenting_complaints || null,
            clinical_notes: clinical_notes || null,
            assessment: assessment || null,
            diagnosis: diagnosis || null,
            plan_notes: plan_notes || null,
            status: finalStatus,
            updated_at: new Date()
          },
          include: {
            created_by: {
              select: {
                first_name: true,
                last_name: true
              }
            }
          }
        })

        // Log audit trail for update
        await createAuditLog({
          userId: session.user.id,
          action: "UPDATE",
          resource: "ClinicalEncounter",
          resourceId: clinicalEncounter.id,
          newValues: {
            patient_id: patientId,
            appointment_id: latestAppointment.id,
            presenting_complaints,
            clinical_notes,
            assessment,
            diagnosis,
            plan_notes,
            status: finalStatus
          }
        })
      } else {
        // Create new clinical encounter
        clinicalEncounter = await prisma.clinicalEncounter.create({
          data: {
            appointment_id: latestAppointment.id,
            presenting_complaints: presenting_complaints || null,
            clinical_notes: clinical_notes || null,
            assessment: assessment || null,
            diagnosis: diagnosis || null,
            plan_notes: plan_notes || null,
            status: finalStatus,
            created_by_id: session.user.id
          },
          include: {
            created_by: {
              select: {
                first_name: true,
                last_name: true
              }
            }
          }
        })

        // Log audit trail for creation
        await createAuditLog({
          userId: session.user.id,
          action: "CREATE",
          resource: "ClinicalEncounter",
          resourceId: clinicalEncounter.id,
          newValues: {
            patient_id: patientId,
            appointment_id: latestAppointment.id,
            presenting_complaints,
            clinical_notes,
            assessment,
            diagnosis,
            plan_notes,
            status: finalStatus
          }
        })
      }
    }

    // Update appointment status based on encounter status
    if (finalStatus === 'COMPLETED' && latestAppointment.status !== 'COMPLETED') {
      await prisma.telemedicineAppointment.update({
        where: { id: latestAppointment.id },
        data: { status: 'COMPLETED' }
      })
    } else if (finalStatus === 'IN_PROGRESS' && latestAppointment.status === 'SCHEDULED') {
      await prisma.telemedicineAppointment.update({
        where: { id: latestAppointment.id },
        data: { status: 'IN_PROGRESS' }
      })
    }

    return NextResponse.json({
      success: true,
      encounter: clinicalEncounter,
      message: finalStatus === 'COMPLETED' 
        ? "Clinical encounter completed successfully" 
        : "Clinical encounter saved as in-progress"
    })
  } catch (error) {
    console.error("Error creating clinical encounter:", error)
    return NextResponse.json(
      { error: "Failed to create clinical encounter" },
      { status: 500 }
    )
  }
}
