import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { resolveTelemedicinePatient } from "@/lib/telemedicine"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission
    const hasPermission = await checkPermission(session.user.role as any, "telemedicine", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const patientId = params.id
    const { enrolleeId: appointmentEnrolleeId, dependent } = await resolveTelemedicinePatient(patientId)

    // Fetch clinical encounters for the patient
    // Filter by dependent_id: null for principal, dependent.id for dependent
    const encounters = await prisma.clinicalEncounter.findMany({
      where: {
        appointment: {
          enrollee_id: appointmentEnrolleeId,
          dependent_id: dependent ? dependent.id : null
        }
      },
      include: {
        created_by: {
          select: {
            first_name: true,
            last_name: true
          }
        },
        appointment: {
          select: {
            scheduled_date: true,
            status: true
          }
        }
      },
      orderBy: {
        created_at: "desc"
      }
    })

    return NextResponse.json({
      success: true,
      encounters
    })
  } catch (error) {
    console.error("Error fetching clinical encounters:", error)
    return NextResponse.json(
      { error: "Failed to fetch clinical encounters" },
      { status: 500 }
    )
  }
}
