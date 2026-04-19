import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { notificationService } from "@/lib/notifications"

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
      facility_id,
      medications,
      delivery_address,
      requested_by
    } = body

    if (!facility_id || !medications || !Array.isArray(medications) || medications.length === 0) {
      return NextResponse.json({ 
        error: "Facility ID and medications array are required" 
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
            email: true,
            residential_address: true,
            enrollee_id: true,
            plan: {
              select: {
                id: true,
                name: true,
                assigned_bands: true,
                band_type: true
              }
            }
          }
        }
      }
    })

    if (!appointment) {
      return NextResponse.json({ 
        error: "Appointment not found" 
      }, { status: 404 })
    }

    // Verify facility exists
    const facility = await prisma.telemedicineFacility.findUnique({
      where: { id: facility_id }
    }) as any

    if (!facility) {
      return NextResponse.json({ 
        error: "Facility not found" 
      }, { status: 404 })
    }

    // Validate band access (same logic as single medication)
    if (appointment.enrollee?.plan) {
      const enrolleeBands = appointment.enrollee.plan.assigned_bands && appointment.enrollee.plan.assigned_bands.length > 0
        ? appointment.enrollee.plan.assigned_bands
        : (appointment.enrollee.plan.band_type ? [appointment.enrollee.plan.band_type] : ["Band A"])

      const getAccessibleBands = (enrolleeBand: string): string[] => {
        const band = enrolleeBand.toLowerCase().trim()
        switch (band) {
          case 'band a':
          case 'a':
            return ['Band A', 'Band B', 'Band C']
          case 'band b':
          case 'b':
            return ['Band B', 'Band C']
          case 'band c':
          case 'c':
            return ['Band C']
          default:
            return [enrolleeBand]
        }
      }

      const normalizeBand = (band: string): string => {
        const normalized = band.toLowerCase().trim()
        if (normalized === 'a' || normalized === 'band a') return 'Band A'
        if (normalized === 'b' || normalized === 'band b') return 'Band B'
        if (normalized === 'c' || normalized === 'band c') return 'Band C'
        return band
      }

      const hasMatchingBand = facility.selected_bands && facility.selected_bands.length > 0
        ? enrolleeBands.some((enrolleeBand: string) => {
            const accessibleBands = getAccessibleBands(enrolleeBand)
            return accessibleBands.some((accessibleBand: string) => {
              const normalizedAccessible = normalizeBand(accessibleBand)
              return facility.selected_bands.some((facilityBand: string) => {
                const normalizedFacility = normalizeBand(facilityBand)
                return normalizedFacility === normalizedAccessible
              })
            })
          })
        : false

      if (!hasMatchingBand) {
        const accessibleBandsSummary = enrolleeBands.map(eb => 
          `${eb} (access to: ${getAccessibleBands(eb).join(", ")})`
        ).join(", ")
        
        return NextResponse.json({
          error: `The enrollee's band(s) (${accessibleBandsSummary}) does not cover services under this facility (Band: ${facility.selected_bands?.join(", ") || "No bands assigned"}).`,
        }, { status: 403 })
      }
    }

    // Create pharmacy orders for each medication
    const createdOrders = []
    const errors = []

    for (const medication of medications) {
      try {
        // Look up price from facility tariff plan
        let orderAmount = 0
        if (medication.medication_id) {
          try {
            const tariff = await prisma.facilityTariff.findUnique({
              where: {
                facility_id_service_id: {
                  facility_id: facility_id,
                  service_id: medication.medication_id
                }
              }
            })

            if (tariff) {
              const unitPrice = tariff.price
              const prescribedQuantity = medication.quantity || 1
              orderAmount = unitPrice * prescribedQuantity
            }
          } catch (priceError) {
            console.error('Error fetching tariff price:', priceError)
          }
        }

        // Create pharmacy order
        const pharmacyOrder = await prisma.pharmacyOrder.create({
          data: {
            appointment_id: id,
            facility_id,
            medication: medication.medication,
            dose: medication.dose || null,
            quantity: medication.quantity ? parseInt(medication.quantity) : null,
            duration: medication.duration || null,
            frequency: medication.frequency || null,
            status: 'PENDING' as const,
            requested_by: requested_by || 'Provider',
            delivery_address: delivery_address || null,
            amount: orderAmount > 0 ? orderAmount : null
          }
        })

        createdOrders.push(pharmacyOrder)

        // Create telemedicine request for EHR API connection
        try {
          await prisma.telemedicineRequest.create({
            data: {
              appointment_id: id,
              enrollee_id: appointment.enrollee.id,
              request_type: 'PHARMACY',
              facility_id,
              test_name: medication.medication,
              description: `Pharmacy order: ${medication.medication} - ${medication.dose || 'N/A'}${medication.quantity ? ` (Qty: ${medication.quantity})` : ''}${medication.duration ? ` for ${medication.duration}` : ''}${medication.frequency ? ` - ${medication.frequency}` : ''}`,
              status: 'PENDING',
              created_by_id: session.user.id
            }
          })
        } catch (ehrError) {
          console.error("Failed to create telemedicine request:", ehrError)
        }

        // Create audit log
        await prisma.auditLog.create({
          data: {
            user_id: session.user.id,
            action: "PHARMACY_ORDER_CREATE",
            resource: "pharmacy_order",
            resource_id: pharmacyOrder.id,
            new_values: pharmacyOrder
          }
        })
      } catch (error) {
        console.error(`Error creating pharmacy order for ${medication.medication}:`, error)
        errors.push({
          medication: medication.medication,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    if (createdOrders.length === 0) {
      return NextResponse.json({
        error: "Failed to create any pharmacy orders",
        errors
      }, { status: 500 })
    }

    // Send single email with all medications
    try {
      const facilityPortalLink = `${process.env.NEXTAUTH_URL}/pharmacy-orders/${createdOrders[0].id}`
      
      // Format medications list for email
      const medicationsList = createdOrders.map(order => ({
        medication: order.medication,
        dose: order.dose || 'N/A',
        quantity: order.quantity || 'N/A',
        duration: order.duration || 'N/A',
        frequency: order.frequency || 'N/A',
        amount: order.amount ? `₦${order.amount.toLocaleString()}` : 'N/A'
      }))

      // Calculate total amount
      const totalAmount = createdOrders.reduce((sum, order) => sum + (order.amount || 0), 0)

      await notificationService.sendPharmacyOrderEmail(
        facility.email,
        facility.facility_name,
        {
          medicationName: `${createdOrders.length} medication(s)`,
          dosage: medicationsList.map(m => `${m.medication} - ${m.dose}`).join(', '),
          instructions: medicationsList.map(m => 
            `${m.medication}: Qty ${m.quantity}, Duration ${m.duration}, Frequency ${m.frequency}`
          ).join('\n'),
          patientName: `${appointment.enrollee.first_name} ${appointment.enrollee.last_name}`,
          patientId: appointment.enrollee.enrollee_id,
          patientPhone: appointment.enrollee.phone_number || 'N/A',
          patientEmail: appointment.enrollee.email || 'N/A',
          patientAddress: delivery_address || appointment.enrollee.residential_address || 'Address not provided',
          orderId: createdOrders[0].id,
          facilityPortalLink: facilityPortalLink,
          requestedBy: requested_by || 'Provider',
          medicationsList: medicationsList,
          totalAmount: totalAmount > 0 ? `₦${totalAmount.toLocaleString()}` : 'N/A'
        }
      )
      
    } catch (emailError) {
      // Don't fail the order creation if email fails
    }

    return NextResponse.json({
      success: true,
      pharmacy_orders: createdOrders,
      total_orders: createdOrders.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully created ${createdOrders.length} pharmacy order(s). A single email has been sent to the pharmacy with all medications.`
    }, { status: 201 })

  } catch (error) {
    console.error("Error creating pharmacy orders:", error)
    return NextResponse.json(
      { 
        error: "Failed to create pharmacy orders",
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    )
  }
}

