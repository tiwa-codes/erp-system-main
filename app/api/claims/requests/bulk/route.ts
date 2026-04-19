import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { ProviderRequestStatus } from "@prisma/client"
import { getClaimsRequestWindowMeta } from "@/lib/claims-request-window"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canAdd = await checkPermission(session.user.role as any, 'claims', 'add')
    if (!canAdd) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const claimsRequestWindow = getClaimsRequestWindowMeta()
    if (!claimsRequestWindow.isOpen) {
      return NextResponse.json({
        error: "Claims request window is closed. You can only submit within the first 7 days of each month (1st to 7th).",
        window_status: claimsRequestWindow.status,
        next_open_at: claimsRequestWindow.nextOpenAt.toISOString(),
        close_at: claimsRequestWindow.closeAt.toISOString(),
        remaining_seconds: claimsRequestWindow.remainingSeconds,
        time_zone: claimsRequestWindow.timeZone,
      }, { status: 403 })
    }

    const body = await request.json()
    const { claim_ids } = body

    if (!claim_ids || !Array.isArray(claim_ids) || claim_ids.length === 0) {
      return NextResponse.json({ error: 'No claim IDs provided' }, { status: 400 })
    }

    const rejectedLinkedRequests = await prisma.providerRequest.findMany({
      where: {
        claim_id: { in: claim_ids },
        status: ProviderRequestStatus.REJECTED
      },
      select: {
        claim_id: true
      },
      distinct: ['claim_id']
    })

    const rejectedClaimIds = rejectedLinkedRequests
      .map((request) => request.claim_id)
      .filter((claimId): claimId is string => Boolean(claimId))

    // First, get ALL claims regardless of status to provide better error messages
    const allClaims = await prisma.claim.findMany({
      where: {
        id: { in: claim_ids }
      },
      select: {
        id: true,
        claim_number: true,
        status: true
      }
    })

    // These are CLAIM IDs from the Claims Request page
    // Find the claims that need to be sent to Vetter 1 (change status from NEW to PENDING)
    const claims = await prisma.claim.findMany({
      where: {
        AND: [
          { id: { in: claim_ids } },
          ...(rejectedClaimIds.length > 0 ? [{ id: { notIn: rejectedClaimIds } }] : []),
          {
            OR: [
              { status: 'NEW' },
              {
                AND: [
                  { status: 'SUBMITTED' },
                  { approval_codes: { some: { is_manual: true } } }
                ]
              }
            ]
          }
        ]
      },
      include: {
        principal: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true
          }
        },
        provider: {
          select: {
            id: true,
            facility_name: true
          }
        },
        approval_codes: {
          select: {
            id: true,
            is_manual: true
          }
        }
      }
    })

    if (claims.length === 0) {
      // Provide detailed information about why claims can't be processed
      const statusCounts = allClaims.reduce((acc, claim) => {
        acc[claim.status] = (acc[claim.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      return NextResponse.json({ 
        error: 'No valid claims found to process. Claims must be NEW, or manual SUBMITTED claims, and must not belong to a rejected provider request.',
        received_ids: claim_ids,
        total_claims_found: allClaims.length,
        status_breakdown: statusCounts,
        rejected_linked_claim_ids: rejectedClaimIds,
        details: 'Only claims with status NEW, or manual SUBMITTED claims, can be sent to Vetter 1. Rejected provider requests are excluded even if the linked claim still has a stale status.'
      }, { status: 400 })
    }

    // 🚀 PROCESS CLAIMS: Send to Vetter 1 (change status from NEW to PENDING)
    const processedClaims = []
    for (const claim of claims) {
      try {
        
        // Update claim status from NEW to PENDING (sent to vetting)
        const updatedClaim = await prisma.claim.update({
          where: { id: claim.id },
          data: {
            status: 'PENDING', // Change from NEW to PENDING
            current_stage: 'vetter1' // Set stage to Vetter 1 when processing
          }
        })

        processedClaims.push(updatedClaim)

      } catch (error) {
        throw error
      }
    }

    // Success response

    // Log audit trail for bulk action
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'CLAIM_BULK_REQUEST',
        resource: 'claim',
        resource_id: processedClaims.map(c => c.id).join(','),
        new_values: { 
          claim_ids: claim_ids, 
          action: 'bulk_request',
          claims_processed: processedClaims.length
        },
      },
    })

    return NextResponse.json({ 
      message: 'Claims sent to Vetter 1 successfully',
      processed_claims: processedClaims.length
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process bulk request' },
      { status: 500 }
    )
  }
}
