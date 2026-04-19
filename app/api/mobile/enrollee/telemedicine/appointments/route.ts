/**
 * GET  /api/mobile/enrollee/telemedicine/appointments   — list appointments
 * POST /api/mobile/enrollee/telemedicine/appointments   — book appointment
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileToken } from "@/lib/mobile-auth"
import { trackStatisticsEvent } from "@/lib/statistics-events"

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const skip = (page - 1) * limit

    const where: any = { enrollee_id: principal.id }
    if (status) where.status = status

    const [appointments, total] = await Promise.all([
      prisma.telemedicineAppointment.findMany({
        where,
        include: {
          clinical_encounters: {
            select: {
              id: true,
              status: true,
              diagnosis: true,
              assessment: true,
            },
          },
          lab_orders: {
            select: { id: true, test_name: true, status: true },
          },
          radiology_orders: {
            select: { id: true, test_name: true, status: true },
          },
          pharmacy_orders: {
            select: { id: true, medication: true, status: true },
          },
        },
        orderBy: { scheduled_date: "desc" },
        skip,
        take: limit,
      }),
      prisma.telemedicineAppointment.count({ where }),
    ])

    await trackStatisticsEvent({
      event: "telemedicine_appointments_view",
      module: "telemedicine",
      stage: "appointments",
      outcome: "success",
      actorType: "enrollee",
      actorId: session.id,
      enrolleeId: session.enrollee_id || null,
      metadata: { total, page, limit, status: status || "all" },
      req,
    })

    return NextResponse.json({
      appointments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error("[MOBILE_TELEMEDICINE_LIST]", error)
    await trackStatisticsEvent({
      event: "telemedicine_appointments_view",
      module: "telemedicine",
      stage: "appointments",
      outcome: "failed",
      actorType: "system",
      metadata: { reason: "server_error" },
      req,
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
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

    const { reason, scheduledDate, clinic, specialization, state, lga, appointmentType, notes, dependentId } = await req.json()

    if (!reason || !scheduledDate) {
      await trackStatisticsEvent({
        event: "telemedicine_booking_create",
        module: "telemedicine",
        stage: "appointments",
        outcome: "failed",
        actorType: "enrollee",
        actorId: session.id,
        enrolleeId: session.enrollee_id || null,
        metadata: { reason: "missing_required_fields" },
        req,
      })
      return NextResponse.json({ error: "reason and scheduledDate are required" }, { status: 400 })
    }

    const appointment = await prisma.telemedicineAppointment.create({
      data: {
        enrollee_id: principal.id,
        dependent_id: dependentId || null,
        reason,
        scheduled_date: new Date(scheduledDate),
        clinic: clinic || null,
        specialization: specialization || null,
        state: state || null,
        lga: lga || null,
        appointment_type: appointmentType || "TELE_CONSULTATION",
        notes: notes || null,
        status: "PENDING",
        // created_by_id intentionally omitted — enrollees have no User account
      },
      include: {
        enrollee: true
      }
    })

    await trackStatisticsEvent({
      event: "telemedicine_booking_create",
      module: "telemedicine",
      stage: "appointments",
      outcome: "success",
      actorType: "enrollee",
      actorId: session.id,
      enrolleeId: session.enrollee_id || null,
      metadata: {
        appointmentId: appointment.id,
        appointmentType: appointment.appointment_type,
        state: appointment.state || null,
        specialization: appointment.specialization || null,
      },
      req,
    })

    // Trigger email notification to TELEMEDICINE role users if it's a tele-consultation
    if (appointment.appointment_type === "TELE_CONSULTATION") {
      try {
        const telemedicineUsers = await prisma.user.findMany({
          where: {
            role: {
              name: {
                in: ['TELEMEDICINE'],
                mode: 'insensitive'
              }
            },
            is_active: true
          },
          select: { email: true }
        })

        const mappedAppointment = {
          appointment_id: appointment.id,
          enrollee: appointment.enrollee,
          appointment_date: appointment.scheduled_date.toLocaleDateString(),
          appointment_time: appointment.scheduled_date.toLocaleTimeString(),
          status: appointment.status
        }

        for (const user of telemedicineUsers) {
          await notificationService.sendTelemedicineAppointmentNotification(mappedAppointment, user.email)
        }
      } catch (notifError) {
        console.error('Failed to send telemedicine appointment notification:', notifError)
      }
    }

    return NextResponse.json({ appointment }, { status: 201 })
  } catch (error) {
    console.error("[MOBILE_TELEMEDICINE_BOOK]", error)
    await trackStatisticsEvent({
      event: "telemedicine_booking_create",
      module: "telemedicine",
      stage: "appointments",
      outcome: "failed",
      actorType: "system",
      metadata: { reason: "server_error" },
      req,
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
