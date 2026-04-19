import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { ClaimStatus, VettingType, VettingStatus } from "@prisma/client"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canVet = await checkPermission(session.user.role as any, 'claims', 'vet')
    if (!canVet) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all pending claims
    const pendingClaims = await prisma.claim.findMany({
      where: {
        status: {
          in: [ClaimStatus.SUBMITTED, ClaimStatus.UNDER_REVIEW]
        }
      },
      select: {
        id: true,
        claim_number: true
      }
    })

    // Create vetting records for all pending claims
    const vettingRecords = pendingClaims.map(claim => ({
      claim_id: claim.id,
      vetter_id: session.user.id,
      vetting_type: VettingType.SMART_ASSISTED,
      status: VettingStatus.IN_PROGRESS,
    }))

    // Batch create vetting records
    await prisma.vettingRecord.createMany({
      data: vettingRecords
    })

    // Update claims status to VETTING
    await prisma.claim.updateMany({
      where: {
        id: {
          in: pendingClaims.map(claim => claim.id)
        }
      },
      data: {
        status: ClaimStatus.VETTING
      }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'BULK_VETTING_START',
        resource: 'claim',
        resource_id: 'bulk',
        new_values: {
          claims_count: pendingClaims.length,
          vetting_type: 'SMART_ASSISTED'
        },
      },
    })

    return NextResponse.json({
      message: 'Bulk vetting started successfully',
      claims_processed: pendingClaims.length
    })
  } catch (error) {
    console.error('Error starting bulk vetting:', error)
    return NextResponse.json(
      { error: 'Failed to start bulk vetting' },
      { status: 500 }
    )
  }
}
