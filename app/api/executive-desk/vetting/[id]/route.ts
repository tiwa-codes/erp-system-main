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

    // Check if user has executive approval permissions
    const hasPermission = await checkPermission(session.user.role as any, "claims", "approve")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const { action, findings } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'approve' or 'reject'" },
        { status: 400 }
      )
    }

    // Find the claim
    const claim = await prisma.claim.findUnique({
      where: { id: params.id },
      include: {
        principal: true,
        provider: true
      }
    })

    if (!claim) {
      return NextResponse.json(
        { error: "Claim not found" },
        { status: 404 }
      )
    }

    if (claim.status !== 'AUDIT_COMPLETED') {
      return NextResponse.json(
        { error: "Claim is not ready for executive approval" },
        { status: 400 }
      )
    }

    // Update claim status based on action
    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'
    
    const updatedClaim = await prisma.claim.update({
      where: { id: params.id },
      data: {
        status: newStatus,
        approved_at: action === 'approve' ? new Date() : null,
        rejected_at: action === 'reject' ? new Date() : null,
        ...(action === 'reject' && { rejection_reason: findings })
      }
    })

    // Create audit record
    await prisma.claimAudit.create({
      data: {
        claim_id: params.id,
        auditor_id: session.user.id,
        audit_type: 'FINANCIAL',
        findings: findings || `Claim ${action}d by executive`,
        status: 'COMPLETED',
        completed_at: new Date()
      }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: `CLAIM_EXECUTIVE_${action.toUpperCase()}`,
        resource: 'claims',
        resource_id: params.id,
        old_values: { status: claim.status },
        new_values: { status: newStatus, findings }
      }
    })

    return NextResponse.json({
      success: true,
      claim: updatedClaim,
      message: `Claim ${action}d successfully`
    })

  } catch (error) {
    console.error("Error processing executive desk vetting:", error)
    return NextResponse.json(
      { error: "Failed to process claim" },
      { status: 500 }
    )
  }
}
