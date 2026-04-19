import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const { approvalCodeId, enrolleeId, providerId, amount } = await request.json()

    if (!approvalCodeId || !enrolleeId || !providerId || !amount) {
      return NextResponse.json({
        success: false,
        error: "Missing required fields: approvalCodeId, enrolleeId, providerId, and amount are required"
      }, { status: 400 })
    }

    // Check if approval code exists and is approved
    const approvalCode = await prisma.providerRequest.findFirst({
      where: {
        id: approvalCodeId,
        status: 'APPROVED'
      },
      include: {
        provider: true,
        enrollee: true
      }
    })

    if (!approvalCode) {
      return NextResponse.json({
        success: false,
        error: "Approval code not found or not approved"
      }, { status: 404 })
    }

    // Check if provider request already has a claim linked to it
    if (approvalCode.claim_id) {
      return NextResponse.json({
        success: false,
        error: "Claims request already sent for this approval code"
      }, { status: 409 })
    }

    // Check if provider request is already in PENDING status (already sent to claims)
    if (approvalCode.status === 'PENDING') {
      return NextResponse.json({
        success: false,
        error: "Claims request already sent. Status is PENDING."
      }, { status: 409 })
    }

    // Create new claim with PENDING status
    const newClaim = await prisma.claim.create({
      data: {
        claim_number: `CLM-${Date.now()}`,
        enrollee_id: approvalCode.enrollee?.enrollee_id || enrolleeId, // Use actual enrollee_id from PrincipalAccount
        principal_id: approvalCode.enrollee?.id || null, // Link to PrincipalAccount
        provider_id: providerId,
        claim_type: 'MEDICAL',
        amount: amount,
        original_amount: amount, // Set original amount
        status: 'SUBMITTED', // This will show as "Pending" in the UI
        current_stage: 'vetter1', // Start at Vetter 1 stage
        submitted_at: new Date(),
        created_by_id: null // Will be set by the session user in a real implementation
      },
      include: {
        provider: {
          select: {
            id: true,
            facility_name: true,
            facility_type: true
          }
        },
        principal: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            enrollee_id: true
          }
        }
      }
    })

    // Update the provider request to link it to the claim and change status
    await prisma.providerRequest.update({
      where: {
        id: approvalCodeId
      },
      data: {
        claim_id: newClaim.id, // Link to the new claim
        status: 'PENDING' // Change to PENDING when sent to claims
      }
    })

    return NextResponse.json({
      success: true,
      message: "Claims request submitted successfully",
      data: {
        claim: newClaim,
        message: "Claim has been created and will appear in the claims module with Pending status"
      }
    })

  } catch (error) {
    console.error("Error processing claims request:", error)
    return NextResponse.json({
      success: false,
      error: "Internal server error. Please try again later."
    }, { status: 500 })
  }
}
