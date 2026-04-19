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
        { error: 'Lab order ID is required' },
        { status: 400 }
      )
    }

    console.log('🔍 Fetching lab order details for public portal:', id)

    // Fetch lab order details with related data
    const labOrder = await prisma.labOrder.findUnique({
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

    if (!labOrder) {
      console.log('❌ Lab order not found:', id)
      return NextResponse.json(
        { error: 'Lab order not found' },
        { status: 404 }
      )
    }

    console.log('✅ Lab order found:', {
      id: labOrder.id,
      test_name: labOrder.test_name,
      status: labOrder.status,
      facility: labOrder.facility?.facility_name
    })

    return NextResponse.json({
      success: true,
      order: labOrder
    })

  } catch (error) {
    console.error('❌ Error fetching lab order details:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}