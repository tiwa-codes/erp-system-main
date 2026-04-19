import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

type TestResultEntry = {
  success: boolean
  [key: string]: string | number | boolean | null | undefined
}

type PharmacyOrderTestResults = {
  timestamp: string
  environment: string | undefined
  appointmentId: string
  session: {
    userId: string
    userRole: string
    userEmail: string
  }
  tests: Record<string, TestResultEntry>
}

export async function POST(request: NextRequest) {
  try {
    // Check if this is production and if we should allow this endpoint
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEBUG_ENDPOINTS) {
      return NextResponse.json({ error: "Debug endpoint disabled in production" }, { status: 404 })
    }

    const body = await request.json()
    const { appointmentId, testMode = true } = body

    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId is required" }, { status: 400 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "No session found" }, { status: 401 })
    }

    const testResults: PharmacyOrderTestResults = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      appointmentId,
      session: {
        userId: session.user.id,
        userRole: session.user.role,
        userEmail: session.user.email
      },
      tests: {}
    }

    void checkPermission

    // Test 1: Check appointment exists
    try {
      const appointment = await prisma.telemedicineAppointment.findUnique({
        where: { id: appointmentId },
        include: {
          enrollee: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              phone_number: true,
              email: true,
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
      
      testResults.tests.appointment_check = {
        success: !!appointment,
        exists: !!appointment,
        enrolleeExists: !!appointment?.enrollee,
        planExists: !!appointment?.enrollee?.plan
      }
      
      if (!appointment) {
        return NextResponse.json(testResults, { status: 200 })
      }

      // Test 2: Check permissions
      try {
        const hasPermission = await checkPermission(session.user.role as any, "telemedicine", "add")
        testResults.tests.permission_check = {
          success: true,
          hasPermission,
          userRole: session.user.role
        }
      } catch (permError) {
        testResults.tests.permission_check = {
          success: false,
          error: permError instanceof Error ? permError.message : "Permission check failed"
        }
      }

      // Test 3: Check if we can fetch facilities
      try {
        const facilities = await prisma.telemedicineFacility.findMany({
          where: { facility_type: 'PHARMACY' },
          take: 1
        })
        testResults.tests.facility_check = {
          success: true,
          pharmacyFacilitiesFound: facilities.length
        }
      } catch (facilityError) {
        testResults.tests.facility_check = {
          success: false,
          error: facilityError instanceof Error ? facilityError.message : "Facility check failed"
        }
      }

      // Test 4: Try to create a test pharmacy order (if not in test mode)
      if (!testMode) {
        try {
          const testPharmacyOrder = await prisma.pharmacyOrder.create({
            data: {
              appointment_id: appointmentId,
              facility_id: "test-facility-id",
              medication: "Test Medication",
              dose: "Test Dose",
              quantity: 1,
              duration: "Test Duration",
              frequency: "Test Frequency",
              status: 'PENDING',
              requested_by: 'Test'
            }
          })
          
          // Clean up immediately
          await prisma.pharmacyOrder.delete({
            where: { id: testPharmacyOrder.id }
          })
          
          testResults.tests.pharmacy_order_create = {
            success: true,
            message: "Test pharmacy order created and deleted successfully"
          }
        } catch (createError) {
          testResults.tests.pharmacy_order_create = {
            success: false,
            error: createError instanceof Error ? createError.message : "Failed to create test pharmacy order"
          }
        }
      }

    } catch (error) {
      testResults.tests.general_error = {
        success: false,
        error: error instanceof Error ? error.message : "General test failed"
      }
    }

    return NextResponse.json(testResults, { status: 200 })

  } catch (error) {
    console.error("Pharmacy order test error:", error)
    return NextResponse.json({
      error: "Pharmacy order test failed",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
