import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import {
  canTakeAction,
  updateClaimStage,
  createVettingAction
} from "@/lib/claims/vetting-workflow"
import { ClaimStatus } from "@prisma/client"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission - only MD can approve at approval stage
    const canVet = await checkPermission(session.user.role as any, 'claims', 'vet')
    if (!canVet) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check if user can take action
    const actionCheck = await canTakeAction(params.id, 'approval', session.user.id)
    if (!actionCheck.canTakeAction) {
      return NextResponse.json(
        { error: actionCheck.reason || "Cannot take action on this claim" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { comments, approvedAmount, serviceVerdicts } = body

    // Get claim
    const claim = await prisma.claim.findUnique({
      where: { id: params.id },
      select: { claim_number: true, current_stage: true, amount: true }
    })

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 })
    }

    // Update claim - final approval
    await prisma.$transaction(async (tx) => {
      // If approvedAmount is provided, update the amount
      const updateData: any = {
        status: ClaimStatus.APPROVED,
        current_stage: null, // Final stage
        approved_at: new Date(),
        processed_at: new Date()
      }

      if (approvedAmount && approvedAmount !== claim.amount) {
        // Create price edit record
        await tx.priceEdit.create({
          data: {
            claim_id: params.id,
            old_amount: claim.amount,
            new_amount: approvedAmount,
            edited_by_id: session.user.id,
            stage: 'approval',
            reason: 'Price adjusted during MD approval'
          }
        })

        updateData.amount = approvedAmount
        updateData.approved_amount = approvedAmount
      } else {
        // If no price change, set approved_amount to current amount
        updateData.approved_amount = claim.amount
      }

      // Create vetting action (handles service-level updates and claim sync)
      await createVettingAction(
        params.id,
        'approval',
        'APPROVED',
        session.user.id,
        comments,
        serviceVerdicts,
        tx
      )

      // Update claim with overall status and amounts
      await tx.claim.update({
        where: { id: params.id },
        data: updateData
      })

      // 🕒 TIMELINE TRACKING (MD_APPROVED)
      try {
        const approvalCodes = await tx.approvalCode.findMany({
          where: { claim_id: params.id }
        })

        for (const code of approvalCodes) {
          // Find previous stage (AUDIT_COMPLETED) to calculate delay
          const prevStage = await tx.approvalCodeTimeline.findFirst({
            where: { approval_code_id: code.id, stage: 'AUDIT_COMPLETED' },
            orderBy: { timestamp: 'desc' }
          })

          let delayMinutes = null
          if (prevStage) {
            delayMinutes = Math.floor((new Date().getTime() - new Date(prevStage.timestamp).getTime()) / (1000 * 60))
          }

          await tx.approvalCodeTimeline.create({
            data: {
              approval_code_id: code.id,
              stage: 'MD_APPROVED',
              timestamp: new Date(),
              user_id: session.user.id,
              delay_minutes: delayMinutes
            }
          })
        }
        console.log(`✅ Timeline entries created for ${approvalCodes.length} approval code(s)`)
      } catch (timelineError) {
        console.error('❌ Failed to create MD Approval timeline entry:', timelineError)
      }
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'CLAIM_MD_APPROVED',
        resource: 'claim',
        resource_id: params.id,
        new_values: {
          claim_number: claim.claim_number,
          stage: 'approval',
          action: 'APPROVED'
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: "Claim approved by MD"
    })
  } catch (error) {
    console.error("Error approving claim at MD:", error)
    return NextResponse.json(
      { error: "Failed to approve claim" },
      { status: 500 }
    )
  }
}







