import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import {
  canTakeAction,
  getNextStage,
  createVettingAction
} from "@/lib/claims/vetting-workflow"
import { notifyStageUsers } from "@/lib/claims/notifications"
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

    // Check permission
    const canVet = await checkPermission(session.user.role as any, 'claims', 'vet')
    if (!canVet) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check if user can take action
    const actionCheck = await canTakeAction(params.id, 'vetter2', session.user.id)
    if (!actionCheck.canTakeAction) {
      return NextResponse.json(
        { error: actionCheck.reason || "Cannot take action on this claim" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { comments, serviceVerdicts } = body

    // Get claim
    const claim = await prisma.claim.findUnique({
      where: { id: params.id },
      select: { claim_number: true, current_stage: true }
    })

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 })
    }

    // Get next stage
    const nextStage = getNextStage('vetter2')

    // Update claim
    await prisma.$transaction(async (tx) => {
      // Create vetting action (handles service-level updates)
      await createVettingAction(
        params.id,
        'vetter2',
        'APPROVED',
        session.user.id,
        comments,
        serviceVerdicts,
        tx
      )

      // Update claim status to VETTER2_COMPLETED
      await tx.claim.update({
        where: { id: params.id },
        data: {
          status: ClaimStatus.VETTER2_COMPLETED,
          current_stage: nextStage,
          processed_at: new Date()
        }
      })

      // 🕒 TIMELINE TRACKING (VETTER2_COMPLETED)
      try {
        const approvalCodes = await tx.approvalCode.findMany({
          where: { claim_id: params.id }
        })

        for (const code of approvalCodes) {
          // Find previous stage (VETTER1_COMPLETED) to calculate delay
          const prevStage = await tx.approvalCodeTimeline.findFirst({
            where: { approval_code_id: code.id, stage: 'VETTER1_COMPLETED' },
            orderBy: { timestamp: 'desc' }
          })

          let delayMinutes = null
          if (prevStage) {
            delayMinutes = Math.floor((new Date().getTime() - new Date(prevStage.timestamp).getTime()) / (1000 * 60))
          }

          await tx.approvalCodeTimeline.create({
            data: {
              approval_code_id: code.id,
              stage: 'VETTER2_COMPLETED',
              timestamp: new Date(),
              user_id: session.user.id,
              delay_minutes: delayMinutes
            }
          })
        }
        console.log(`✅ Timeline entries created for ${approvalCodes.length} approval code(s)`)
      } catch (timelineError) {
        console.error('❌ Failed to create Vetter 2 timeline entry:', timelineError)
      }
    })

    // Notify users in next stage
    if (nextStage) {
      void notifyStageUsers(params.id, nextStage, claim.claim_number)
    }

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'CLAIM_VETTER2_APPROVED',
        resource: 'claim',
        resource_id: params.id,
        new_values: {
          claim_number: claim.claim_number,
          stage: 'vetter2',
          action: 'APPROVED'
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: "Claim approved and moved to Audit"
    })
  } catch (error) {
    console.error("Error approving claim at Vetter 2:", error)
    return NextResponse.json(
      { error: "Failed to approve claim" },
      { status: 500 }
    )
  }
}
