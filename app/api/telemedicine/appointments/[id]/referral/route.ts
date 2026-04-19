import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

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
    const hasPermission = await checkPermission(session.user.role as any, "telemedicine", "add")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const {
      referral_type,
      reason,
      requested_by
    } = body

    if (!referral_type || !reason) {
      return NextResponse.json({ 
        error: "Referral type and reason are required" 
      }, { status: 400 })
    }

    // Verify appointment exists and get patient details
    const appointment = await prisma.telemedicineAppointment.findUnique({
      where: { id },
      include: {
        enrollee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            phone_number: true,
            enrollee_id: true
          }
        }
      }
    })

    if (!appointment) {
      return NextResponse.json({ 
        error: "Appointment not found" 
      }, { status: 404 })
    }

    // Create referral
    const referral = await prisma.referral.create({
      data: {
        appointment_id: id,
        referral_type,
        reason,
        status: 'PENDING',
        requested_by: requested_by || 'Provider'
      }
    })

    // Create telemedicine request for call centre
    await prisma.telemedicineRequest.create({
      data: {
        appointment_id: id,
        enrollee_id: appointment.enrollee.id,
        request_type: 'REFERRAL',
        test_name: referral_type,
        description: `Referral: ${referral_type} - ${reason}`,
        status: 'PENDING',
        created_by_id: session.user.id
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "REFERRAL_CREATE",
        resource: "referral",
        resource_id: referral.id,
        new_values: referral
      }
    })

    return NextResponse.json({
      success: true,
      referral: referral
    }, { status: 201 })

  } catch (error) {
    console.error("Error creating referral:", error)
    return NextResponse.json(
      { error: "Failed to create referral" },
      { status: 500 }
    )
  }
}
