import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { ClaimStatus } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, 'claims', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get user's provider information for filtering
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { 
        provider: true,
        role: {
          select: {
            name: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Build where clause for provider filtering
    const whereClause: any = {}
    // If user is PROVIDER role, only show metrics for their provider
    // SUPER_ADMIN, ADMIN, PROVIDER_MANAGER, and other roles can see all metrics
    if (user.role?.name === 'PROVIDER' && user.provider_id) {
      whereClause.provider_id = user.provider_id
    }

    const rejectedClaimIdsFromRequests = await prisma.providerRequest.findMany({
      where: {
        ...whereClause,
        claim_id: { not: null },
        status: 'REJECTED'
      },
      select: {
        claim_id: true
      },
      distinct: ['claim_id']
    })

    const rejectedClaimIds = rejectedClaimIdsFromRequests
      .map((request) => request.claim_id)
      .filter((claimId): claimId is string => Boolean(claimId))

    const [
      approvedServices,
      rejectedServices,
      paidServices,
      newServices,
      pendingServices,
    ] = await Promise.all([
      prisma.claim.count({
        where: {
          ...whereClause,
          status: 'APPROVED'
        }
      }),

      prisma.claim.count({
        where: {
          ...whereClause,
          OR: [
            { status: 'REJECTED' },
            ...(rejectedClaimIds.length > 0 ? [{ id: { in: rejectedClaimIds } }] : [])
          ]
        }
      }),

      prisma.claim.count({
        where: {
          ...whereClause,
          status: 'PAID'
        },
      }),

      prisma.claim.count({
        where: {
          ...whereClause,
          status: 'NEW',
          ...(rejectedClaimIds.length > 0 ? { id: { notIn: rejectedClaimIds } } : {})
        }
      }),

      prisma.claim.count({
        where: {
          ...whereClause,
          ...(rejectedClaimIds.length > 0 ? { id: { notIn: rejectedClaimIds } } : {}),
          NOT: {
            status: {
              in: [ClaimStatus.NEW, ClaimStatus.APPROVED, ClaimStatus.REJECTED, ClaimStatus.PAID]
            }
          }
        }
      })
    ])

    const metrics = {
      approved_services: approvedServices,
      rejected_services: rejectedServices,
      paid_services: paidServices,
      new_services: newServices,
      pending_services: pendingServices,
    }

    return NextResponse.json({ metrics })
  } catch (error) {
    console.error('Error fetching claims request metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}
