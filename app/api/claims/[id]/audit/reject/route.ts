import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { 
  canTakeAction, 
  getPreviousStage, 
  updateClaimStage, 
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
    const [canVet, canInternalControlAudit] = await Promise.all([
      checkPermission(session.user.role as any, 'claims', 'vet'),
      checkPermission(session.user.role as any, 'operation-desk', 'edit', 'audit')
    ])
    if (!canVet && !canInternalControlAudit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check if user can take action
    const actionCheck = await canTakeAction(params.id, 'audit', session.user.id)
    if (!actionCheck.canTakeAction) {
      return NextResponse.json(
        { error: actionCheck.reason || "Cannot take action on this claim" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { comments, reason } = body
    const commentText = typeof comments === "string" ? comments.trim() : ""
    const reasonText =
      typeof reason === "string" && reason.trim()
        ? reason.trim()
        : commentText || "Rejected by Audit"

    // Get claim
    const claim = await prisma.claim.findUnique({
      where: { id: params.id },
      select: { claim_number: true }
    })

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 })
    }

    // Get previous stage (vetter2)
    const previousStage = getPreviousStage('audit')

    // Update claim - reject back to Vetter 2
    await prisma.$transaction(async (tx) => {
      // Create vetting action
      await createVettingAction(
        params.id,
        'audit',
        'REJECTED_BACK',
        session.user.id,
        commentText
      )

      // Update claim status and stage
      await tx.claim.update({
        where: { id: params.id },
        data: {
          status: ClaimStatus.VETTING,
          current_stage: previousStage, // Back to Vetter 2
          rejected_at: new Date(),
          rejection_reason: reasonText
        }
      })
    })

    // Notify users in previous stage
    if (previousStage) {
      void notifyStageUsers(params.id, previousStage, claim.claim_number)
    }

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'CLAIM_AUDIT_REJECTED',
        resource: 'claim',
        resource_id: params.id,
        new_values: {
          claim_number: claim.claim_number,
          stage: 'audit',
          action: 'REJECTED_BACK',
          reason: reasonText
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: "Claim rejected and returned to Vetter 2"
    })
  } catch (error) {
    console.error("Error rejecting claim at Audit:", error)
    return NextResponse.json(
      { error: "Failed to reject claim" },
      { status: 500 }
    )
  }
}







