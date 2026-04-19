import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id

    // Fetch lab order with patient and facility details
    const labOrder = await prisma.labOrder.findUnique({
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

    if (!labOrder) {
      return NextResponse.json({ error: "Lab order not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      labOrder
    })
  } catch (error) {
    console.error("Error fetching lab order:", error)
    return NextResponse.json(
      { error: "Failed to fetch lab order" },
      { status: 500 }
    )
  }
}
