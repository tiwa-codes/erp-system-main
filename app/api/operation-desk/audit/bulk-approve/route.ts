import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { ClaimStatus } from "@prisma/client"
import { createVettingAction } from "@/lib/claims/vetting-workflow"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canAudit = await checkPermission(session.user.role as any, "operation-desk", "edit", "audit")
    if (!canAudit) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const { provider_id, comments } = body

    if (!provider_id) {
      return NextResponse.json({ error: "Provider ID is required" }, { status: 400 })
    }

    // Get all pending claims at audit stage for this provider
    const pendingClaims = await prisma.claim.findMany({
      where: {
        provider_id,
        current_stage: "audit",
        status: ClaimStatus.VETTER2_COMPLETED
      }
    })

    if (pendingClaims.length === 0) {
      return NextResponse.json({ 
        success: true,
        message: "No pending claims found for this provider",
        approved_count: 0
      })
    }

    const result = await prisma.$transaction(async (tx) => {
      let updatedCount = 0

      for (const claim of pendingClaims) {
        await createVettingAction(
          claim.id,
          'audit',
          'APPROVED',
          session.user.id,
          comments || "Bulk approved by Auditor",
          undefined,
          tx
        )

        await tx.claim.update({
          where: { id: claim.id },
          data: {
            current_stage: "approval",
            status: ClaimStatus.AUDIT_COMPLETED,
            processed_at: new Date()
          }
        })

        await tx.auditLog.create({
          data: {
            user_id: session.user.id,
            action: "CLAIM_AUDIT_BULK_APPROVED",
            resource: "claim",
            resource_id: claim.id,
            old_values: {
              status: claim.status,
              current_stage: claim.current_stage
            },
            new_values: {
              status: ClaimStatus.AUDIT_COMPLETED,
              current_stage: "approval"
            }
          }
        })

        updatedCount += 1
      }

      return { count: updatedCount }
    })

    return NextResponse.json({
      success: true,
      message: `Successfully approved ${result.count} claims`,
      approved_count: result.count
    })

  } catch (error) {
    console.error("Error bulk approving claims:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "Failed to bulk approve claims" 
      },
      { status: 500 }
    )
  }
}
