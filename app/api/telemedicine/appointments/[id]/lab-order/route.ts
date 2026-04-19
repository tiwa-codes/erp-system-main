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
      test_name,
      requested_by
    } = body

    if (!facility_id || !test_name) {
      return NextResponse.json({ 
        error: "Facility ID and test name are required" 
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

    // Look up price from facility tariff plan
    let orderAmount = 0
    try {
      // Find service type by name (case-insensitive)
      const serviceType = await prisma.serviceType.findFirst({
        where: {
          service_name: { equals: test_name, mode: 'insensitive' },
          service_category: 'Laboratory Services'
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
          orderAmount = tariff.price
        }
      }
    } catch (priceError) {
      // Continue with amount = 0 if price lookup fails
    }

    // Create lab order
    const labOrder = await prisma.labOrder.create({
      data: {
        appointment_id: id,
        facility_id,
        test_name,
        status: 'PENDING',
        requested_by: requested_by || 'Provider',
        amount: orderAmount
      }
    })

    // Create telemedicine request for EHR API connection
    await prisma.telemedicineRequest.create({
      data: {
        appointment_id: id,
        enrollee_id: appointment.enrollee.id,
        request_type: 'LAB',
        facility_id,
        test_name,
        description: `Lab test request: ${test_name}`,
        status: 'PENDING',
        created_by_id: session.user.id
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "LAB_ORDER_CREATE",
        resource: "lab_order",
        resource_id: labOrder.id,
        new_values: labOrder
      }
    })

    // Send email notification to facility
    try {
      const publicLink = `${process.env.NEXTAUTH_URL}/public/lab-results/${labOrder.id}`
      const facilityPortalLink = `${process.env.NEXTAUTH_URL}/public/lab-results/${labOrder.id}`
      
      await notificationService.sendLabOrderEmail(
        facility.email,
        facility.facility_name,
        {
          testName: test_name,
          patientName: `${appointment.enrollee.first_name} ${appointment.enrollee.last_name}`,
          patientId: appointment.enrollee.enrollee_id,
          patientPhone: appointment.enrollee.phone_number || 'N/A',
          orderId: labOrder.id,
          publicLink: publicLink,
          facilityPortalLink: facilityPortalLink,
          requestedBy: requested_by || 'Provider'
        }
      )
      
    } catch (emailError) {
      // Don't fail the lab order creation if email fails
    }

    return NextResponse.json({
      success: true,
      lab_order: labOrder,
      band_validation: {
        passed: true,
        message: "Facility is accessible under enrollee's band(s)",
        enrollee_bands: appointment.enrollee?.plan ? 
          (appointment.enrollee.plan.assigned_bands && appointment.enrollee.plan.assigned_bands.length > 0 
            ? appointment.enrollee.plan.assigned_bands 
            : (appointment.enrollee.plan.band_type ? [appointment.enrollee.plan.band_type] : ["Band A"])) 
          : ["Band A"]
      },
      message: "Lab order created successfully. Email sent to facility and EHR request created. Claim will be created when facility completes the order."
    }, { status: 201 })

  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create lab order" },
      { status: 500 }
    )
  }
}
