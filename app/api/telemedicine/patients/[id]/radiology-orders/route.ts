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
    const { enrolleeId: appointmentEnrolleeId } = await resolveTelemedicinePatient(patientId)

    // Fetch radiology orders for the patient
    const radiologyOrders = await prisma.radiologyOrder.findMany({
      where: {
        appointment: {
          enrollee_id: appointmentEnrolleeId
        }
      },
      select: {
        id: true,
        test_name: true,
        status: true,
        results: true,
        notes: true,
        requested_by: true,
        created_at: true,
        updated_at: true,
        completed_at: true,
        amount: true,
        facility: {
          select: {
            facility_name: true,
            facility_type: true
          }
        },
        appointment: {
          select: {
            scheduled_date: true,
            reason: true
          }
        }
      },
      orderBy: {
        created_at: "desc"
      }
    })

    return NextResponse.json({
      success: true,
      radiologyOrders
    })
  } catch (error) {
    console.error("Error fetching radiology orders:", error)
    return NextResponse.json(
      { error: "Failed to fetch radiology orders" },
      { status: 500 }
    )
  }
}
