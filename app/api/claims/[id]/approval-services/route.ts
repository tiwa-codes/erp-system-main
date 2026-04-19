import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: claimId } = params

    // Find the approval code linked to this claim (exclude soft-deleted codes)
    const approvalCode = await prisma.approvalCode.findFirst({
      where: {
        claim_id: claimId,
        is_deleted: false
      },
      include: {
        service_items: {
          select: {
            id: true,
            service_name: true,
            service_amount: true,
            quantity: true,
            tariff_price: true,
            service_id: true,
            is_initial: true,
            is_ad_hoc: true,
            added_at: true
          },
          orderBy: {
            added_at: 'asc'
          }
        },
        enrollee: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true
          }
        }
      }
    })

    if (!approvalCode) {
      return NextResponse.json({
        success: false,
        message: "No approval code found for this claim"
      }, { status: 404 })
    }

    // Map service_items to the format expected by the vetter page
    const services = approvalCode.service_items.map(item => ({
      id: item.id,
      service_name: item.service_name,
      service_amount: Number(item.service_amount),
      quantity: item.quantity || 1,
      total: Number(item.service_amount) * (item.quantity || 1),
      tariff_price: item.tariff_price ? Number(item.tariff_price) : null,
      service_id: item.service_id,
      is_initial: item.is_initial,
      is_ad_hoc: item.is_ad_hoc
    }))

    // Calculate summary
    const totalServices = services.length
    const grandTotal = services.reduce((sum, service) => sum + service.total, 0)

    return NextResponse.json({
      success: true,
      services,
      summary: {
        total_services: totalServices,
        grand_total: grandTotal
      },
      approval_code: {
        id: approvalCode.id,
        approval_code: approvalCode.approval_code,
        enrollee_id: approvalCode.enrollee_id,
        enrollee_name: approvalCode.enrollee_name,
        hospital: approvalCode.hospital,
        diagnosis: approvalCode.diagnosis,
        amount: approvalCode.amount,
        status: approvalCode.status,
        created_at: approvalCode.created_at,
        enrollee: approvalCode.enrollee
      }
    })

  } catch (error) {
    console.error("Error fetching approval services for claim:", error)
    return NextResponse.json(
      { error: "Failed to fetch approval services" },
      { status: 500 }
    )
  }
}
