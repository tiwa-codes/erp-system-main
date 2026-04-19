import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { ClaimStatus, PayoutStatus, TransactionStatus, TransactionType } from "@prisma/client"

const mapProviderFilter = (providerId: string) => {
  if (providerId === "unknown") {
    return { provider_id: null }
  }
  return { provider_id: providerId }
}

const findPendingPayout = (payouts: { id: string; status: PayoutStatus }[]) => {
  return payouts.find((payout) => payout.status !== PayoutStatus.PAID) || payouts[0] || null
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const hasPermission = await checkPermission(session.user.role as any, "finance", "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const providerId = (body.provider_id || "").toString()
    const comments = typeof body.comments === "string" ? body.comments.trim() : undefined

    if (!providerId) {
      return NextResponse.json({ error: "Provider ID is required" }, { status: 400 })
    }

    const claims = await prisma.claim.findMany({
      where: {
        status: ClaimStatus.APPROVED,
        ...mapProviderFilter(providerId),
      },
      select: {
        id: true,
        claim_number: true,
        amount: true,
        provider: {
          select: {
            facility_name: true,
          },
        },
        payouts: {
          select: {
            id: true,
            status: true,
            payout_reference: true,
          },
        },
      },
    })

    if (claims.length === 0) {
      return NextResponse.json(
        { error: "No approved claims found for the selected provider" },
        { status: 404 }
      )
    }

    const processed = await prisma.$transaction(async (tx) => {
      const processedClaimIds: string[] = []

      for (const claim of claims) {
        const payoutToUpdate = findPendingPayout(claim.payouts)
        const payoutAmount = Number(claim.amount || 0)
        const referenceBase = payoutToUpdate?.payout_reference || `BULKPAY-${claim.claim_number}`
        let payout

        if (payoutToUpdate) {
          payout = await tx.payout.update({
            where: { id: payoutToUpdate.id },
            data: {
              status: PayoutStatus.PAID,
              amount: payoutAmount,
              processed_at: new Date(),
              payout_reference: payoutToUpdate.payout_reference || referenceBase,
            },
          })
        } else {
          payout = await tx.payout.create({
            data: {
              claim_id: claim.id,
              amount: payoutAmount,
              payout_method: "BANK_TRANSFER",
              payout_reference: `${referenceBase}-${Date.now()}`,
              status: PayoutStatus.PAID,
              processed_at: new Date(),
            },
          })
        }

        await tx.claim.update({
          where: { id: claim.id },
          data: {
            status: ClaimStatus.PAID,
            processed_at: new Date(),
          },
        })

        await tx.financialTransaction.create({
          data: {
            transaction_type: TransactionType.CLAIM_PAYOUT,
            amount: payoutAmount,
            currency: "NGN",
            reference_id: payout.payout_reference,
            reference_type: "PAYOUT",
            description: `Bulk payout for claim ${claim.claim_number}`,
            status: TransactionStatus.PAID,
            processed_at: new Date(),
            created_by_id: session.user.id,
          },
        })

        await tx.auditLog.create({
          data: {
            user_id: session.user.id,
            action: "SETTLEMENT_BULK_PAY",
            resource: "claim",
            resource_id: claim.id,
            old_values: { status: ClaimStatus.APPROVED },
            new_values: {
              status: ClaimStatus.PAID,
              payout_id: payout.id,
              comments: comments || null,
            },
          },
        })

        // 🕒 TIMELINE TRACKING (FINANCE_PAID)
        try {
          const approvalCodes = await tx.approvalCode.findMany({
            where: { claim_id: claim.id }
          })

          for (const code of approvalCodes) {
            // Find previous stage (MD_APPROVED) to calculate delay
            const prevStage = await tx.approvalCodeTimeline.findFirst({
              where: { approval_code_id: code.id, stage: 'MD_APPROVED' },
              orderBy: { timestamp: 'desc' }
            })

            let delayMinutes = null
            if (prevStage) {
              delayMinutes = Math.floor((new Date().getTime() - new Date(prevStage.timestamp).getTime()) / (1000 * 60))
            }

            await tx.approvalCodeTimeline.create({
              data: {
                approval_code_id: code.id,
                stage: 'FINANCE_PAID',
                timestamp: new Date(),
                user_id: session.user.id,
                delay_minutes: delayMinutes
              }
            })
          }
        } catch (timelineError) {
          console.error('❌ Failed to create bulk finance paid timeline entry:', timelineError)
        }

        processedClaimIds.push(claim.id)
      }

      return processedClaimIds
    })

    const providerName = claims[0]?.provider?.facility_name || "selected provider"

    return NextResponse.json({
      success: true,
      message: `Paid ${processed.length} claim(s) for ${providerName}`,
      paid_count: processed.length,
    })
  } catch (error) {
    console.error("Error processing bulk payout:", error)
    return NextResponse.json(
      { error: "Failed to process bulk payment" },
      { status: 500 }
    )
  }
}
