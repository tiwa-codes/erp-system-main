import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { ClaimStatus } from "@prisma/client"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canApprove = await checkPermission(session.user.role as any, 'claims', 'approve')
    if (!canApprove) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { outcome, comments } = body

    if (!outcome) {
      return NextResponse.json({ error: 'Approval outcome is required' }, { status: 400 })
    }

    // Update claim status based on outcome
    let newStatus: ClaimStatus
    let updateData: any = {}

    switch (outcome) {
      case 'approved':
        newStatus = ClaimStatus.APPROVED
        updateData.approved_at = new Date()
        break
      case 'rejected':
        newStatus = ClaimStatus.REJECTED
        updateData.rejected_at = new Date()
        updateData.rejection_reason = comments || 'Rejected by Medical Director'
        break
      case 'pending_investigation':
        newStatus = ClaimStatus.UNDER_REVIEW
        break
      case 'requires_additional_info':
        newStatus = ClaimStatus.UNDER_REVIEW
        break
      default:
        return NextResponse.json({ error: 'Invalid approval outcome' }, { status: 400 })
    }

    updateData.status = newStatus
    updateData.processed_at = new Date()

    const updatedClaim = await prisma.claim.update({
      where: { id: params.id },
      data: updateData,
    })

    // Create audit record for approval decision
    await prisma.claimAudit.create({
      data: {
        claim_id: params.id,
        auditor_id: session.user.id,
        audit_type: 'COMPLIANCE',
        findings: comments || `Claim ${outcome} by Medical Director`,
        status: 'COMPLETED',
        completed_at: new Date(),
      },
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'CLAIM_APPROVAL',
        resource: 'claim',
        resource_id: params.id,
        new_values: {
          status: newStatus,
          outcome,
          comments,
          approved_at: updateData.approved_at,
          rejected_at: updateData.rejected_at,
          rejection_reason: updateData.rejection_reason
        },
      },
    })

    return NextResponse.json({
      message: 'Approval decision submitted successfully',
      claim: updatedClaim
    })
  } catch (error) {
    console.error('Error submitting approval:', error)
    return NextResponse.json(
      { error: 'Failed to submit approval decision' },
      { status: 500 }
    )
  }
}
