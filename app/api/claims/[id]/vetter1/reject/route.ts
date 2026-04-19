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

    // Check permission
    const canVet = await checkPermission(session.user.role as any, 'claims', 'vet')
    if (!canVet) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check if user can take action
    const actionCheck = await canTakeAction(params.id, 'vetter1', session.user.id)
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
        : commentText || "Rejected by Vetter 1"

    // Get claim
    const claim = await prisma.claim.findUnique({
      where: { id: params.id },
      select: { claim_number: true }
    })

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 })
    }

    // Update claim - reject back to provider (no stage)
    await prisma.$transaction(async (tx) => {
      // Create vetting action
      await createVettingAction(
        params.id,
        'vetter1',
        'REJECTED',
        session.user.id,
        commentText
      )

      // Update claim status to REJECTED
      await tx.claim.update({
        where: { id: params.id },
        data: {
          status: ClaimStatus.REJECTED,
          current_stage: null, // Back to provider
          rejected_at: new Date(),
          rejection_reason: reasonText
        }
      })
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'CLAIM_VETTER1_REJECTED',
        resource: 'claim',
        resource_id: params.id,
        new_values: {
          claim_number: claim.claim_number,
          stage: 'vetter1',
          action: 'REJECTED',
          reason: reasonText
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: "Claim rejected and returned to provider"
    })
  } catch (error) {
    console.error("Error rejecting claim at Vetter 1:", error)
    return NextResponse.json(
      { error: "Failed to reject claim" },
      { status: 500 }
    )
  }
}








