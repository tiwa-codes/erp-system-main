import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { resolveTelemedicinePatient } from "@/lib/telemedicine"

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const enrolleeIdParam = searchParams.get("enrollee_id") || ""

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    if (enrolleeIdParam) {
      const resolved = await resolveTelemedicinePatient(enrolleeIdParam)
      where.enrollee_id = resolved.enrolleeId
    }
    
    if (search) {
      where.OR = [
        { enrollee: { enrollee_id: { contains: search, mode: "insensitive" } } },
        { enrollee: { first_name: { contains: search, mode: "insensitive" } } },
        { enrollee: { last_name: { contains: search, mode: "insensitive" } } },
        { dependent: { dependent_id: { contains: search, mode: "insensitive" } } },
        { dependent: { first_name: { contains: search, mode: "insensitive" } } },
        { dependent: { last_name: { contains: search, mode: "insensitive" } } },
        { reason: { contains: search, mode: "insensitive" } },
      ]
    }

    if (status && status !== "all") {
      where.status = status
    } else {
      // By default, exclude PENDING appointments from general view (they belong in the Pending Bookings module)
      where.status = { not: "PENDING" }
    }

    const [appointments, total] = await Promise.all([
      prisma.telemedicineAppointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduled_date: "desc" },
        include: {
          enrollee: {
            select: {
              id: true,
              enrollee_id: true,
              first_name: true,
              last_name: true,
              phone_number: true,
              plan: {
                select: {
                  name: true
                }
              }
            }
          },
          dependent: {
            select: {
              id: true,
              dependent_id: true,
              first_name: true,
              last_name: true,
              phone_number: true,
            }
          },
          provider: {
            select: {
              id: true,
              facility_name: true
            }
          },
          created_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true
            }
          }
        }
      }),
      prisma.telemedicineAppointment.count({ where })
    ])

    // Format appointments - prefer the actual dependent relation for dependent bookings.
    const formattedAppointments = await Promise.all(appointments.map(async (appointment) => {
      let dependentInfo = appointment.dependent

      // Fallback for older appointments that only stored dependent info in notes.
      if (!dependentInfo && appointment.notes && appointment.notes.includes('DEPENDENT_ID:')) {
        try {
          const dependentIdMatch = appointment.notes.match(/DEPENDENT_ID:([^|]+)/)

          if (dependentIdMatch && dependentIdMatch[1]) {
            const dependentId = dependentIdMatch[1].trim()

            dependentInfo = await prisma.dependent.findUnique({
              where: { id: dependentId },
              select: {
                id: true,
                dependent_id: true,
                first_name: true,
                last_name: true,
                phone_number: true
              }
            })
          }
        } catch (error) {
          console.error('[Appointment] Error parsing dependent info from notes:', error)
        }
      }
      
      // Use dependent info if available, otherwise use principal info
      if (dependentInfo) {
        return {
          id: appointment.id,
          enrollee_name: `${dependentInfo.first_name} ${dependentInfo.last_name}`,
          enrollee_id: dependentInfo.dependent_id,
          principal_account_id: appointment.enrollee.id, // Keep principal ID for navigation
          dependent_id: dependentInfo.id, // Include dependent ID for navigation
          phone_number: dependentInfo.phone_number || appointment.enrollee.phone_number,
          plan: appointment.enrollee.plan?.name || 'No Plan',
          appointment_type: appointment.appointment_type,
          reason: appointment.reason,
          scheduled_date: appointment.scheduled_date,
          status: appointment.status,
          specialization: appointment.specialization,
          provider_name: appointment.provider?.facility_name || 'Not Assigned',
          created_by: appointment.created_by
            ? `${appointment.created_by.first_name || ''} ${appointment.created_by.last_name || ''}`.trim()
            : "System",
          created_at: appointment.created_at,
          is_dependent: true,
          principal_enrollee_id: appointment.enrollee.enrollee_id,
          principal_name: `${appointment.enrollee.first_name} ${appointment.enrollee.last_name}`
        }
      } else {
        return {
          id: appointment.id,
          enrollee_name: `${appointment.enrollee.first_name} ${appointment.enrollee.last_name}`,
          enrollee_id: appointment.enrollee.enrollee_id,
          principal_account_id: appointment.enrollee.id,
          phone_number: appointment.enrollee.phone_number,
          plan: appointment.enrollee.plan?.name || 'No Plan',
          appointment_type: appointment.appointment_type,
          reason: appointment.reason,
          scheduled_date: appointment.scheduled_date,
          status: appointment.status,
          specialization: appointment.specialization,
          provider_name: appointment.provider?.facility_name || 'Not Assigned',
          created_by: appointment.created_by
            ? `${appointment.created_by.first_name || ''} ${appointment.created_by.last_name || ''}`.trim()
            : "System",
          created_at: appointment.created_at,
          is_dependent: false
        }
      }
    }))

    return NextResponse.json({
      success: true,
      appointments: formattedAppointments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error("Error fetching appointments:", error)
    return NextResponse.json(
      { error: "Failed to fetch appointments" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const {
      enrollee_id,
      reason,
      appointment_type,
      scheduled_date,
      specialization,
      state,
      lga
    } = body

    if (!enrollee_id || !appointment_type || !scheduled_date || !specialization) {
      return NextResponse.json({ 
        error: "Enrollee ID, appointment type, scheduled date, and specialization are required" 
      }, { status: 400 })
    }

    // Check if enrollee_id is a principal account or dependent
    let principalAccountId = enrollee_id
    let enrollee = await prisma.principalAccount.findUnique({
      where: { id: enrollee_id }
    })
    let dependentInfo = null

    // If not found in principal accounts, check if it's a dependent
    if (!enrollee) {
      
      const dependent = await prisma.dependent.findUnique({
        where: { id: enrollee_id },
        include: {
          principal: true
        }
      })

      if (!dependent) {
        return NextResponse.json({ 
          error: "Enrollee not found" 
        }, { status: 404 })
      }


      // Store dependent info to return in response
      dependentInfo = {
        id: dependent.id,
        dependent_id: dependent.dependent_id,
        first_name: dependent.first_name,
        last_name: dependent.last_name,
        phone_number: dependent.phone_number
      }

      // Use the principal account ID for the appointment (appointments are linked to principals)
      principalAccountId = dependent.principal_id
      enrollee = dependent.principal
      
      if (!enrollee) {
        return NextResponse.json({ 
          error: "Principal account not found for dependent" 
        }, { status: 404 })
      }
    } else {
    }

    // Create appointment using the principal account ID
    const appointment = await prisma.telemedicineAppointment.create({
      data: {
        enrollee_id: principalAccountId, // Use principal account ID (works for both principals and dependents)
        dependent_id: dependentInfo?.id || null, // Set dependent_id if appointment is for a dependent
        reason: reason || null,
        appointment_type: appointment_type as any,
        scheduled_date: new Date(scheduled_date),
        status: 'SCHEDULED',
        specialization: specialization || null,
        state: state || null,
        lga: lga || null,
        created_by_id: session.user.id
      },
      include: {
        enrollee: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true,
            phone_number: true
          }
        }
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "TELEMEDICINE_APPOINTMENT_CREATE",
        resource: "telemedicine_appointment",
        resource_id: appointment.id,
        new_values: appointment
      }
    })

    // Return appointment with correct enrollee info (dependent if applicable)
    const appointmentResponse: any = {
      id: appointment.id,
      appointment_type: appointment.appointment_type,
      reason: appointment.reason,
      scheduled_date: appointment.scheduled_date,
      status: appointment.status
    }

    // If it was booked for a dependent, show dependent info; otherwise show principal info
    if (dependentInfo) {
      appointmentResponse.enrollee_name = `${dependentInfo.first_name} ${dependentInfo.last_name}`
      appointmentResponse.enrollee_id = dependentInfo.dependent_id
      appointmentResponse.is_dependent = true
      appointmentResponse.principal_id = enrollee.id
      appointmentResponse.principal_enrollee_id = enrollee.enrollee_id
    } else {
      appointmentResponse.enrollee_name = `${appointment.enrollee.first_name} ${appointment.enrollee.last_name}`
      appointmentResponse.enrollee_id = appointment.enrollee.enrollee_id
      appointmentResponse.is_dependent = false
    }

    return NextResponse.json({
      success: true,
      appointment: appointmentResponse
    }, { status: 201 })

  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create appointment" },
      { status: 500 }
    )
  }
}
