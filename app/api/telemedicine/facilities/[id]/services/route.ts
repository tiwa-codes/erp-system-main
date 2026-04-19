import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, 'telemedicine', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: facilityId } = params

    // Verify facility exists
    const facility = await prisma.telemedicineFacility.findUnique({
      where: { id: facilityId },
      select: {
        id: true,
        facility_name: true,
        facility_type: true,
        phone_number: true,
        email: true,
        status: true,
        selected_bands: true
      }
    })

    if (!facility) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
    }

    // Fetch all services sent to this facility
    const [labOrders, radiologyOrders, pharmacyOrders, telemedicineRequests] = await Promise.all([
      // Lab Orders
      prisma.labOrder.findMany({
        where: { facility_id: facilityId },
        include: {
          appointment: {
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
          }
        },
        orderBy: { created_at: 'desc' }
      }),

      // Radiology Orders
      prisma.radiologyOrder.findMany({
        where: { facility_id: facilityId },
        include: {
          appointment: {
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
          }
        },
        orderBy: { created_at: 'desc' }
      }),

      // Pharmacy Orders
      prisma.pharmacyOrder.findMany({
        where: { facility_id: facilityId },
        include: {
          appointment: {
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
          }
        },
        orderBy: { created_at: 'desc' }
      }),

      // Telemedicine Requests
      prisma.telemedicineRequest.findMany({
        where: { facility_id: facilityId },
        include: {
          appointment: {
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
          },
          created_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true
            }
          }
        },
        orderBy: { created_at: 'desc' }
      })
    ])

    // Calculate statistics
    const stats = {
      total_services: labOrders.length + radiologyOrders.length + pharmacyOrders.length,
      lab_orders: labOrders.length,
      radiology_orders: radiologyOrders.length,
      pharmacy_orders: pharmacyOrders.length,
      total_amount: labOrders.reduce((sum, order) => sum + (order.amount || 0), 0) +
                   radiologyOrders.reduce((sum, order) => sum + (order.amount || 0), 0) +
                   pharmacyOrders.reduce((sum, order) => sum + (order.amount || 0), 0),
      pending_services: [...labOrders, ...radiologyOrders, ...pharmacyOrders].filter(order => order.status === 'PENDING').length,
      completed_services: [...labOrders, ...radiologyOrders, ...pharmacyOrders].filter(order => order.status === 'COMPLETED').length,
      rejected_services: [...labOrders, ...radiologyOrders, ...pharmacyOrders].filter(order => order.status === 'REJECTED').length
    }

    // Format services data
    const allServices = [
      ...labOrders.map(order => {
        const enrollee = order.appointment?.enrollee
        const patientName = enrollee
          ? `${enrollee.first_name || ''} ${enrollee.last_name || ''}`.trim() || 'Unknown Patient'
          : 'Unknown Patient'
        return {
          id: order.id,
          type: 'LAB',
          service_name: order.test_name,
          patient_name: patientName,
          patient_id: enrollee?.enrollee_id || 'N/A',
          patient_phone: enrollee?.phone_number || 'N/A',
          amount: Number(order.amount || 0),
          status: order.status,
          created_at: order.created_at,
          completed_at: order.completed_at,
          requested_by: order.requested_by,
          results: order.results,
          notes: order.notes
        }
      }),
      ...radiologyOrders.map(order => {
        const enrollee = order.appointment?.enrollee
        const patientName = enrollee
          ? `${enrollee.first_name || ''} ${enrollee.last_name || ''}`.trim() || 'Unknown Patient'
          : 'Unknown Patient'
        return {
          id: order.id,
          type: 'RADIOLOGY',
          service_name: order.test_name,
          patient_name: patientName,
          patient_id: enrollee?.enrollee_id || 'N/A',
          patient_phone: enrollee?.phone_number || 'N/A',
          amount: Number(order.amount || 0),
          status: order.status,
          created_at: order.created_at,
          completed_at: order.completed_at,
          requested_by: order.requested_by,
          results: order.results,
          notes: order.notes
        }
      }),
      ...pharmacyOrders.map(order => {
        const enrollee = order.appointment?.enrollee
        const patientName = enrollee
          ? `${enrollee.first_name || ''} ${enrollee.last_name || ''}`.trim() || 'Unknown Patient'
          : 'Unknown Patient'
        return {
          id: order.id,
          type: 'PHARMACY',
          service_name: order.medication,
          patient_name: patientName,
          patient_id: enrollee?.enrollee_id || 'N/A',
          patient_phone: enrollee?.phone_number || 'N/A',
          amount: Number(order.amount || 0),
          status: order.status,
          created_at: order.created_at,
          completed_at: order.completed_at,
          requested_by: order.requested_by,
          results: order.results,
          notes: order.notes
        }
      })
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({
      success: true,
      facility,
      stats,
      services: allServices,
      telemedicine_requests: telemedicineRequests
    })

  } catch (error) {
    console.error('Error fetching facility services:', error)
    return NextResponse.json(
      { error: 'Failed to fetch facility services' },
      { status: 500 }
    )
  }
}
