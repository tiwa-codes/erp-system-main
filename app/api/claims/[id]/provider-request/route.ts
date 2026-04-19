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

    // Find the provider request linked to this claim
    const providerRequest = await prisma.providerRequest.findFirst({
      where: {
        claim_id: claimId
      },
      include: {
        request_items: {
          select: {
            id: true,
            service_name: true,
            service_amount: true,
            quantity: true,
            tariff_price: true,
            is_ad_hoc: true,
            created_at: true
          }
        },
        enrollee: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true
          }
        },
        provider: {
          select: {
            id: true,
            facility_name: true,
            facility_type: true
          }
        }
      }
    })

    if (!providerRequest) {
      // Try to find via approval code link
      const approvalCode = await prisma.approvalCode.findFirst({
        where: {
          claim_id: claimId
        },
        select: {
          approval_code: true,
          enrollee_id: true,
          hospital: true,
          services: true,
          amount: true,
          diagnosis: true,
          service_items: {
            select: {
              id: true,
              service_name: true,
              service_amount: true,
              quantity: true,
              tariff_price: true,
              service_id: true
            }
          }
        }
      })

      if (approvalCode) {
        // Return approval code data formatted as provider request
        return NextResponse.json({
          success: true,
          providerRequest: {
            id: 'from-approval-code',
            approval_code: approvalCode.approval_code,
            enrollee_id: approvalCode.enrollee_id,
            hospital: approvalCode.hospital,
            services: approvalCode.services,
            amount: approvalCode.amount,
            diagnosis: approvalCode.diagnosis,
            request_items: approvalCode.service_items.map(item => ({
              id: item.id,
              service_name: item.service_name,
              service_amount: item.service_amount,
              quantity: item.quantity || 1,
              tariff_price: item.tariff_price,
              service_id: item.service_id
            }))
          }
        })
      }

      return NextResponse.json({
        success: false,
        message: "No provider request or approval code found for this claim"
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      providerRequest: {
        id: providerRequest.id,
        request_id: providerRequest.request_id,
        enrollee_id: providerRequest.enrollee_id,
        provider_id: providerRequest.provider_id,
        hospital: providerRequest.hospital,
        services: providerRequest.services,
        amount: providerRequest.amount,
        status: providerRequest.status,
        diagnosis: providerRequest.diagnosis,
        admission_required: providerRequest.admission_required,
        created_at: providerRequest.created_at,
        request_items: providerRequest.request_items,
        enrollee: providerRequest.enrollee,
        provider: providerRequest.provider
      }
    })

  } catch (error) {
    console.error("Error fetching provider request for claim:", error)
    return NextResponse.json(
      { error: "Failed to fetch provider request" },
      { status: 500 }
    )
  }
}
