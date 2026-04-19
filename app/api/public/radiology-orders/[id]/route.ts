import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id

    // Fetch radiology order with patient and facility details
    const radiologyOrder = await prisma.radiologyOrder.findUnique({
      where: { id: orderId },
      include: {
        appointment: {
          include: {
            enrollee: {
              select: {
                first_name: true,
                last_name: true,
                enrollee_id: true,
                phone_number: true
              }
            }
          }
        },
        facility: {
          select: {
            facility_name: true
          }
        }
      }
    })

    if (!radiologyOrder) {
      return NextResponse.json({ error: "Radiology order not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      radiologyOrder
    })
  } catch (error) {
    console.error("Error fetching radiology order:", error)
    return NextResponse.json(
      { error: "Failed to fetch radiology order" },
      { status: 500 }
    )
  }
}
