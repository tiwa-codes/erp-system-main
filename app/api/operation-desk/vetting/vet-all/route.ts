import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has audit permissions
    const hasPermission = await checkPermission(session.user.role as any, "claims", "audit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Find all claims ready for audit vetting
    const claimsToVet = await prisma.claim.findMany({
      where: { status: 'VETTER2_COMPLETED' },
      include: {
        principal: true,
        provider: true
      }
    })

    if (claimsToVet.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No claims available for audit vetting",
        processed: 0
      })
    }

    // Process all claims
    const results = await Promise.allSettled(
      claimsToVet.map(async (claim) => {
        // Auto-approve for now (you can implement your business logic here)
        const updatedClaim = await prisma.claim.update({
          where: { id: claim.id },
          data: {
            status: 'AUDIT_COMPLETED',
            processed_at: new Date()
          }
        })

        // Create audit record
        await prisma.claimAudit.create({
          data: {
            claim_id: claim.id,
            auditor_id: session.user.id,
            audit_type: 'COMPLIANCE',
            findings: 'Auto-approved by bulk audit',
            status: 'COMPLETED',
            completed_at: new Date()
          }
        })

        return updatedClaim
      })
    )

    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'BULK_AUDIT_VETTING',
        resource: 'claims',
        resource_id: null,
        new_values: { 
          total_processed: claimsToVet.length,
          successful,
          failed
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `Bulk audit vetting completed`,
      processed: successful,
      failed,
      total: claimsToVet.length
    })

  } catch (error) {
    console.error("Error in bulk operation desk vetting:", error)
    return NextResponse.json(
      { error: "Failed to process bulk vetting" },
      { status: 500 }
    )
  }
}
