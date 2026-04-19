import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission
    const hasPermission = await checkPermission(session.user.role as any, "telemedicine", "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const appointmentId = params.id
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 })
    }

    const appointment = await prisma.telemedicineAppointment.findUnique({
      where: { id: appointmentId }
    })

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      )
    }

    const updatedAppointment = await prisma.telemedicineAppointment.update({
      where: { id: appointmentId },
      data: { status }
    })

    // Log audit trail for update
    await createAuditLog({
      userId: session.user.id,
      action: "UPDATE_STATUS",
      resource: "TelemedicineAppointment",
      resourceId: appointment.id,
      newValues: {
        status
      }
    })

    return NextResponse.json({
      success: true,
      appointment: updatedAppointment,
      message: `Appointment status updated to ${status}`
    })
  } catch (error) {
    console.error("Error updating appointment status:", error)
    return NextResponse.json(
      { error: "Failed to update appointment status" },
      { status: 500 }
    )
  }
}
