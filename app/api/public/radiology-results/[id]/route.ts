import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: 'Radiology order ID is required' },
        { status: 400 }
      )
    }

    console.log('🔍 Fetching radiology order details for public portal:', id)

    // Fetch radiology order details with related data
    const radiologyOrder = await prisma.radiologyOrder.findUnique({
      where: { id: id },
      include: {
        appointment: {
          include: {
            enrollee: {
              select: {
                id: true,
                enrollee_id: true,
                first_name: true,
                last_name: true,
                phone_number: true,
                email: true,
                date_of_birth: true,
                gender: true,
              }
            }
          }
        },
        facility: {
          select: {
            id: true,
            facility_name: true,
            email: true,
            phone_number: true,
          }
        }
      }
    })

    if (!radiologyOrder) {
      console.log('❌ Radiology order not found:', id)
      return NextResponse.json(
        { error: 'Radiology order not found' },
        { status: 404 }
      )
    }

    console.log('✅ Radiology order found:', {
      id: radiologyOrder.id,
      test_name: radiologyOrder.test_name,
      status: radiologyOrder.status,
      facility: radiologyOrder.facility?.facility_name
    })

    return NextResponse.json({
      success: true,
      order: radiologyOrder
    })

  } catch (error) {
    console.error('❌ Error fetching radiology order details:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}