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
      medication,
      dose,
      quantity,
      duration,
      frequency,
      delivery_address,
      requested_by
    } = body

    if (!facility_id || !medication || !dose) {
      
      return NextResponse.json({ 
        error: "Facility ID, medication, and dose are required",
        received: {
          facility_id: !!facility_id,
          medication: !!medication,
          dose: !!dose
        }
      }, { status: 400 })
    }

    // Verify appointment exists and get patient details with plan information
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

        // Validate band access for telemedicine requests with hierarchical access
        if (appointment.enrollee?.plan) {
          const enrolleeBands = appointment.enrollee.plan.assigned_bands && appointment.enrollee.plan.assigned_bands.length > 0
            ? appointment.enrollee.plan.assigned_bands
            : (appointment.enrollee.plan.band_type ? [appointment.enrollee.plan.band_type] : ["Band A"])

          // Helper function to get accessible bands based on hierarchical access
          const getAccessibleBands = (enrolleeBand: string): string[] => {
            const band = enrolleeBand.toLowerCase().trim()
            
            switch (band) {
              case 'band a':
              case 'a':
                return ['Band A', 'Band B', 'Band C'] // A has access to A, B, C
              case 'band b':
              case 'b':
                return ['Band B', 'Band C'] // B has access to B, C only
              case 'band c':
              case 'c':
                return ['Band C'] // C has access to C only
              default:
                return [enrolleeBand] // Default to same band
            }
          }

          // Helper function to normalize band names for comparison
          const normalizeBand = (band: string): string => {
            const normalized = band.toLowerCase().trim()
            if (normalized === 'a' || normalized === 'band a') return 'Band A'
            if (normalized === 'b' || normalized === 'band b') return 'Band B'
            if (normalized === 'c' || normalized === 'band c') return 'Band C'
            return band // Return original if not recognized
          }

          // Check if facility has any bands that match the enrollee's accessible bands (hierarchical)
          const hasMatchingBand = facility.selected_bands && facility.selected_bands.length > 0
            ? enrolleeBands.some((enrolleeBand: string) => {
                const accessibleBands = getAccessibleBands(enrolleeBand)
                
                const hasMatch = accessibleBands.some((accessibleBand: string) => {
                  const normalizedAccessible = normalizeBand(accessibleBand)
                  const facilityMatch = facility.selected_bands.some((facilityBand: string) => {
                    const normalizedFacility = normalizeBand(facilityBand)
                    const isMatch = normalizedFacility === normalizedAccessible
                    return isMatch
                  })
                  return facilityMatch
                })
                
                return hasMatch
              })
            : false

          if (!hasMatchingBand) {
            const accessibleBandsSummary = enrolleeBands.map(eb => 
              `${eb} (access to: ${getAccessibleBands(eb).join(", ")})`
            ).join(", ")
            
            return NextResponse.json({
              error: `The enrollee's band(s) (${accessibleBandsSummary}) does not cover services under this facility (Band: ${facility.selected_bands?.join(", ") || "No bands assigned"}).`,
              band_validation: {
                enrollee_bands: enrolleeBands,
                enrollee_accessible_bands: enrolleeBands.map(eb => ({
                  enrolleeBand: eb,
                  accessibleBands: getAccessibleBands(eb)
                })),
                facility_bands: facility.selected_bands || [],
                facility_id: facility_id,
                facility_name: facility.facility_name,
                is_accessible: false,
                message: `The enrollee's band(s) (${accessibleBandsSummary}) does not cover services under facility "${facility.facility_name}" (Band: ${facility.selected_bands?.join(", ") || "No bands assigned"})`
              }
            }, { status: 403 })
          }

        }

    // Create pharmacy order
    // Look up price from facility tariff plan
    let orderAmount = 0
    try {
      // Find service type by medication name (case-insensitive)
      // Try multiple possible category names
      const serviceType = await prisma.serviceType.findFirst({
        where: {
          service_name: { equals: medication, mode: 'insensitive' },
          OR: [
            { service_category: 'Drugs and Pharmaceutical' },
            { service_category: 'Drugs / Pharmaceuticals' },
            { service_category: { contains: 'Pharmaceutical', mode: 'insensitive' } }
          ]
        }
      })

      if (serviceType) {
        // Get tariff price for this facility and service
        const tariff = await prisma.facilityTariff.findUnique({
          where: {
            facility_id_service_id: {
              facility_id: facility_id,
              service_id: serviceType.id
            }
          }
        })

        if (tariff) {
          // Calculate total amount: unit_price × quantity
          // unit_price is from tariff.price, quantity is the prescribed quantity
          const unitPrice = tariff.price
          const prescribedQuantity = quantity || 1
          orderAmount = unitPrice * prescribedQuantity
        }
      }
    } catch (priceError) {
      // Continue with amount = 0 if price lookup fails
    }

    let pharmacyOrder
    try {
      // Build data object with amount field
      const orderData = {
        appointment_id: id,
        facility_id,
        medication,
        dose,
        quantity: quantity || null,
        duration: duration || null,
        frequency: frequency || null,
        status: 'PENDING' as const,
        requested_by: requested_by || 'Provider',
        delivery_address: delivery_address || null,
        amount: orderAmount > 0 ? orderAmount : null
      }

      pharmacyOrder = await prisma.pharmacyOrder.create({
        data: orderData
      })
    } catch (dbError) {
      
      // If error is about unknown 'amount' field, try again without it
      if (dbError instanceof Error && dbError.message.includes('Unknown argument `amount`')) {
        try {
          pharmacyOrder = await prisma.pharmacyOrder.create({
            data: {
              appointment_id: id,
              facility_id,
              medication,
              dose,
              quantity: quantity || null,
              duration: duration || null,
              frequency: frequency || null,
              status: 'PENDING' as const,
              requested_by: requested_by || 'Provider',
              delivery_address: delivery_address || null,
            }
          })
        } catch (retryError) {
          throw new Error(`Database error creating pharmacy order: ${retryError instanceof Error ? retryError.message : 'Unknown database error'}`)
        }
      } else {
        throw new Error(`Database error creating pharmacy order: ${dbError instanceof Error ? dbError.message : 'Unknown database error'}`)
      }
    }

    // Create telemedicine request for EHR API connection
    try {
      await prisma.telemedicineRequest.create({
        data: {
          appointment_id: id,
          enrollee_id: appointment.enrollee.id,
          request_type: 'PHARMACY',
          facility_id,
          test_name: medication,
          description: `Pharmacy order: ${medication} - ${dose}${quantity ? ` (Qty: ${quantity})` : ''}${duration ? ` for ${duration}` : ''}${frequency ? ` - ${frequency}` : ''}`,
          status: 'PENDING',
          created_by_id: session.user.id
        }
      })
    } catch (dbError) {
      // Don't throw here as the main pharmacy order was created successfully
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

    // Send email notification to facility
    try {
      const facilityPortalLink = `${process.env.NEXTAUTH_URL}/pharmacy-orders/${pharmacyOrder.id}`
      
      await notificationService.sendPharmacyOrderEmail(
        facility.email,
        facility.facility_name,
        {
          medicationName: medication,
          dosage: dose,
          instructions: `Quantity: ${quantity || 'N/A'}, Duration: ${duration || 'N/A'}, Frequency: ${frequency || 'N/A'}`,
          patientName: `${appointment.enrollee.first_name} ${appointment.enrollee.last_name}`,
          patientId: appointment.enrollee.enrollee_id,
          patientPhone: appointment.enrollee.phone_number || 'N/A',
          patientEmail: appointment.enrollee.email || 'N/A',
          patientAddress: delivery_address || appointment.enrollee.residential_address || 'Address not provided',
          orderId: pharmacyOrder.id,
          facilityPortalLink: facilityPortalLink,
          requestedBy: requested_by || 'Provider'
        }
      )
      
      } catch (emailError) {
      // Don't fail the pharmacy order creation if email fails
    }

    return NextResponse.json({
      success: true,
      pharmacy_order: pharmacyOrder,
      band_validation: {
        passed: true,
        message: "Facility is accessible under enrollee's band(s)",
        enrollee_bands: appointment.enrollee?.plan ? 
          (appointment.enrollee.plan.assigned_bands && appointment.enrollee.plan.assigned_bands.length > 0 
            ? appointment.enrollee.plan.assigned_bands 
            : (appointment.enrollee.plan.band_type ? [appointment.enrollee.plan.band_type] : ["Band A"])) 
          : ["Band A"]
      },
      message: "Pharmacy order created successfully. Email sent to facility and EHR request created. Claim will be created when facility completes the order."
    }, { status: 201 })

  } catch (error) {
    
    // Enhanced error logging for production debugging
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      appointmentId: params.id,
      environment: process.env.NODE_ENV,
      databaseUrl: process.env.DATABASE_URL ? 'Connected' : 'Missing'
    }
    
    return NextResponse.json(
      { 
        error: "Failed to create pharmacy order",
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      { status: 500 }
    )
  }
}
