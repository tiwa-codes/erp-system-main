import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has finance permissions
    const hasPermission = await checkPermission(session.user.role as any, "finance", "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const claimId = params.id

    // Find the claim
    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
      include: {
        principal: {
          include: {
            organization: true
          }
        },
        provider: true
      }
    })

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 })
    }

    if (claim.status !== 'APPROVED') {
      return NextResponse.json({ error: "Claim is not approved" }, { status: 400 })
    }

    // Check if payout already exists
    const existingPayout = await prisma.payout.findFirst({
      where: { claim_id: claimId }
    })

    if (existingPayout) {
      return NextResponse.json({ error: "Payout already exists for this claim" }, { status: 400 })
    }

    // Create payout record
    const payout = await prisma.payout.create({
      data: {
        claim_id: claimId,
        amount: claim.amount,
        status: 'PROCESSED',
        processed_at: new Date(),
        processed_by_id: session.user.id,
        payment_method: 'BANK_TRANSFER', // Default payment method
        reference_number: `PAY${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`
      },
      include: {
        claim: {
          include: {
            principal: true,
            provider: true
          }
        },
        processed_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    })

    // Create financial transaction record
    await prisma.financialTransaction.create({
      data: {
        transaction_type: 'CLAIM_PAYOUT',
        amount: claim.amount,
        currency: 'NGN',
        reference_id: payout.reference_number,
        reference_type: 'PAYOUT',
        description: `Payout for claim ${claim.claim_number}`,
        status: 'PROCESSED',
        processed_at: new Date(),
        created_by_id: session.user.id
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PAYOUT_PROCESS',
        resource: 'payout',
        resource_id: payout.id,
        new_values: payout
      }
    })

    return NextResponse.json({
      success: true,
      payout
    })

  } catch (error) {
    console.error("Error processing payout:", error)
    return NextResponse.json(
      { error: "Failed to process payout" },
      { status: 500 }
    )
  }
}
