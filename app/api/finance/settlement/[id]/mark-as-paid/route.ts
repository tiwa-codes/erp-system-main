import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function PATCH(
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

    // Get the claim details
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
      return NextResponse.json({
        error: "Claim is not approved for settlement",
        details: `Current status: ${claim.status}`
      }, { status: 400 })
    }

    // Check if payout already exists
    const existingPayout = await prisma.payout.findFirst({
      where: { claim_id: claimId }
    })

    if (existingPayout) {
      // Update existing payout to PAID
      const updatedPayout = await prisma.payout.update({
        where: { id: existingPayout.id },
        data: {
          status: 'PAID'
        },
        include: {
          claim: {
            include: {
              principal: true,
              provider: true
            }
          }
        }
      })

      // Create financial transaction record
      const financialTransaction = await prisma.financialTransaction.create({
        data: {
          transaction_type: 'CLAIM_PAYOUT',
          amount: claim.amount,
          currency: 'NGN',
          reference_id: `PAYOUT-${claimId.slice(-8).toUpperCase()}`,
          reference_type: 'PAYOUT',
          description: `Payout for claim ${claim.claim_number}`,
          status: 'PAID',
          processed_at: new Date(),
          created_by_id: session.user.id
        }
      })

      // Note: GL posting is now manual - users must post from Financial Transactions module

      // Update claim status to PAID
      await prisma.claim.update({
        where: { id: claimId },
        data: {
          status: 'PAID',
          processed_at: new Date()
        }
      })

      // Create audit log for the payment
      await prisma.auditLog.create({
        data: {
          user_id: session.user.id,
          action: "SETTLEMENT_MARKED_PAID",
          resource: "payout",
          resource_id: existingPayout.id,
          old_values: {
            status: existingPayout.status,
            amount: existingPayout.amount,
            claim_id: existingPayout.claim_id
          },
          new_values: {
            status: 'PAID'
          }
        }
      })

      // 🕒 TIMELINE TRACKING (FINANCE_PAID)
      try {
        const approvalCodes = await prisma.approvalCode.findMany({
          where: { claim_id: claimId }
        })

        for (const code of approvalCodes) {
          // Find previous stage (MD_APPROVED) to calculate delay
          const prevStage = await prisma.approvalCodeTimeline.findFirst({
            where: { approval_code_id: code.id, stage: 'MD_APPROVED' },
            orderBy: { timestamp: 'desc' }
          })

          let delayMinutes = null
          if (prevStage) {
            delayMinutes = Math.floor((new Date().getTime() - new Date(prevStage.timestamp).getTime()) / (1000 * 60))
          }

          await prisma.approvalCodeTimeline.create({
            data: {
              approval_code_id: code.id,
              stage: 'FINANCE_PAID',
              timestamp: new Date(),
              user_id: session.user.id,
              delay_minutes: delayMinutes
            }
          })
        }
        console.log(`✅ Timeline entries created for ${approvalCodes.length} approval code(s)`)
      } catch (timelineError) {
        console.error('❌ Failed to create Finance Paid timeline entry:', timelineError)
      }

      return NextResponse.json({
        success: true,
        message: "Settlement marked as paid successfully",
        payout: {
          id: updatedPayout.id,
          status: updatedPayout.status,
          amount: updatedPayout.amount,
          claim_number: updatedPayout.claim.claim_number
        }
      })
    } else {
      // Create new payout with PAID status
      const payout = await prisma.payout.create({
        data: {
          claim_id: claimId,
          amount: claim.amount,
          payout_method: 'BANK_TRANSFER',
          payout_reference: `PAY${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
          status: 'PAID',
          processed_at: new Date()
        },
        include: {
          claim: {
            include: {
              principal: true,
              provider: true
            }
          }
        }
      })

      // Update claim status to PAID
      await prisma.claim.update({
        where: { id: claimId },
        data: {
          status: 'PAID',
          processed_at: new Date()
        }
      })

      // Create financial transaction record
      const financialTransaction = await prisma.financialTransaction.create({
        data: {
          transaction_type: 'CLAIM_PAYOUT',
          amount: claim.amount,
          currency: 'NGN',
          reference_id: payout.payout_reference,
          reference_type: 'PAYOUT',
          description: `Payout for claim ${claim.claim_number}`,
          status: 'PAID',
          processed_at: new Date(),
          created_by_id: session.user.id
        }
      })

      // Note: GL posting is now manual - users must post from Financial Transactions module

      // Create audit log for the payment
      await prisma.auditLog.create({
        data: {
          user_id: session.user.id,
          action: "SETTLEMENT_MARKED_PAID",
          resource: "payout",
          resource_id: payout.id,
          new_values: payout
        }
      })

      // 🕒 TIMELINE TRACKING (FINANCE_PAID)
      try {
        const approvalCodes = await prisma.approvalCode.findMany({
          where: { claim_id: claimId }
        })

        for (const code of approvalCodes) {
          // Find previous stage (MD_APPROVED) to calculate delay
          const prevStage = await prisma.approvalCodeTimeline.findFirst({
            where: { approval_code_id: code.id, stage: 'MD_APPROVED' },
            orderBy: { timestamp: 'desc' }
          })

          let delayMinutes = null
          if (prevStage) {
            delayMinutes = Math.floor((new Date().getTime() - new Date(prevStage.timestamp).getTime()) / (1000 * 60))
          }

          await prisma.approvalCodeTimeline.create({
            data: {
              approval_code_id: code.id,
              stage: 'FINANCE_PAID',
              timestamp: new Date(),
              user_id: session.user.id,
              delay_minutes: delayMinutes
            }
          })
        }
        console.log(`✅ Timeline entries created for ${approvalCodes.length} approval code(s) (New Payout)`)
      } catch (timelineError) {
        console.error('❌ Failed to create Finance Paid timeline entry for new payout:', timelineError)
      }

      return NextResponse.json({
        success: true,
        message: "Settlement marked as paid successfully",
        payout: {
          id: payout.id,
          status: payout.status,
          amount: payout.amount,
          claim_number: payout.claim.claim_number
        }
      })
    }

  } catch (error) {
    console.error("Error marking settlement as paid:", error)
    return NextResponse.json(
      { error: "Failed to mark settlement as paid" },
      { status: 500 }
    )
  }
}