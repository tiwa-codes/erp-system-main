import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const pharmacyOrder = await prisma.pharmacyOrder.findUnique({
      where: { id },
      include: {
        appointment: {
          include: {
            enrollee: {
              select: {
                first_name: true,
                last_name: true,
                enrollee_id: true,
                phone_number: true,
                email: true,
                residential_address: true,
              }
            }
          }
        },
        facility: {
          select: {
            facility_name: true,
            email: true,
            phone_number: true,
          }
        }
      }
    })

    if (!pharmacyOrder) {
      return NextResponse.json({ error: "Pharmacy order not found" }, { status: 404 })
    }

    // Fetch all pharmacy orders for the same appointment
    const allPharmacyOrders = await prisma.pharmacyOrder.findMany({
      where: {
        appointment_id: pharmacyOrder.appointment_id,
        facility_id: pharmacyOrder.facility_id
      },
      orderBy: {
        created_at: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      pharmacyOrder: pharmacyOrder,
      allOrders: allPharmacyOrders, // Include all orders from the same appointment
      totalOrders: allPharmacyOrders.length
    })

  } catch (error) {
    console.error("Error fetching pharmacy order:", error)
    return NextResponse.json(
      { error: "Failed to fetch pharmacy order" },
      { status: 500 }
    )
  }
}
