/**
 * GET /api/mobile/enrollee/telemedicine/appointments/[id]
 * Full appointment detail including encounter, lab, radiology, pharmacy orders.
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileToken } from "@/lib/mobile-auth"
import { trackStatisticsEvent } from "@/lib/statistics-events"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await verifyMobileToken(req)
    if (!session || session.role !== "ENROLLEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const principal = await prisma.principalAccount.findUnique({
      where: { id: session.id },
      select: { id: true },
    })

    if (!principal) {
      return NextResponse.json({ error: "Enrollee account not found" }, { status: 404 })
    }

    const appointment = await prisma.telemedicineAppointment.findUnique({
      where: { id: params.id },
      include: {
        clinical_encounters: {
          select: {
            id: true,
            presenting_complaints: true,
            clinical_notes: true,
            assessment: true,
            diagnosis: true,
            plan_notes: true,
            status: true,
            created_at: true,
          },
        },
        lab_orders: {
          select: {
            id: true,
            test_name: true,
            status: true,
            amount: true,
            findings: true,
            recommendations: true,
            notes: true,
            pdf_report: true,
            submitted_at: true,
            completed_at: true,
          },
        },
        radiology_orders: {
          select: {
            id: true,
            test_name: true,
            status: true,
            amount: true,
            findings: true,
            recommendations: true,
            notes: true,
            pdf_report: true,
            submitted_at: true,
            completed_at: true,
          },
        },
        pharmacy_orders: {
          select: {
            id: true,
            medication: true,
            dose: true,
            quantity: true,
            duration: true,
            frequency: true,
            status: true,
            amount: true,
            notes: true,
            completed_at: true,
          },
        },
        referrals: {
          select: {
            id: true,
            referral_type: true,
            reason: true,
            status: true,
          },
        },
      },
    })

    if (!appointment) {
      await trackStatisticsEvent({
        event: "telemedicine_appointment_detail_view",
        module: "telemedicine",
        stage: "appointment_detail",
        outcome: "failed",
        actorType: "enrollee",
        actorId: session.id,
        enrolleeId: session.enrollee_id || null,
        metadata: { reason: "appointment_not_found", appointmentId: params.id },
        req,
      })
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    // Ensure this appointment belongs to the logged-in enrollee
    if (appointment.enrollee_id !== principal.id) {
      await trackStatisticsEvent({
        event: "telemedicine_appointment_detail_view",
        module: "telemedicine",
        stage: "appointment_detail",
        outcome: "failed",
        actorType: "enrollee",
        actorId: session.id,
        enrolleeId: session.enrollee_id || null,
        metadata: { reason: "forbidden", appointmentId: params.id },
        req,
      })
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await trackStatisticsEvent({
      event: "telemedicine_appointment_detail_view",
      module: "telemedicine",
      stage: "appointment_detail",
      outcome: "success",
      actorType: "enrollee",
      actorId: session.id,
      enrolleeId: session.enrollee_id || null,
      metadata: {
        appointmentId: appointment.id,
        status: appointment.status,
        labOrders: appointment.lab_orders.length,
        radiologyOrders: appointment.radiology_orders.length,
        pharmacyOrders: appointment.pharmacy_orders.length,
      },
      req,
    })

    return NextResponse.json({ appointment })
  } catch (error) {
    console.error("[MOBILE_TELEMEDICINE_DETAIL]", error)
    await trackStatisticsEvent({
      event: "telemedicine_appointment_detail_view",
      module: "telemedicine",
      stage: "appointment_detail",
      outcome: "failed",
      actorType: "system",
      metadata: { reason: "server_error", appointmentId: params.id },
      req,
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
