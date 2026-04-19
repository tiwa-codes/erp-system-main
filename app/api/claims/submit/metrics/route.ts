import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canViewClaims = await checkPermission(session.user.role as any, 'claims', 'view')
    if (!canViewClaims) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30' // days
    const days = parseInt(period)

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get metrics
    const [
      totalSubmitted,
      pendingClaims,
      approvedClaims,
      rejectedClaims,
      totalAmount,
      averageAmount,
      claimsByType,
      claimsByStatus,
      recentClaims
    ] = await Promise.all([
      // Total submitted claims in period
      prisma.claim.count({
        where: {
          created_at: {
            gte: startDate
          }
        }
      }),

      // Pending claims
      prisma.claim.count({
        where: {
          status: "SUBMITTED",
          created_at: {
            gte: startDate
          }
        }
      }),

      // Approved claims
      prisma.claim.count({
        where: {
          status: "APPROVED",
          created_at: {
            gte: startDate
          }
        }
      }),

      // Rejected claims
      prisma.claim.count({
        where: {
          status: "REJECTED",
          created_at: {
            gte: startDate
          }
        }
      }),

      // Total amount
      prisma.claim.aggregate({
        where: {
          created_at: {
            gte: startDate
          }
        },
        _sum: {
          amount: true
        }
      }),

      // Average amount
      prisma.claim.aggregate({
        where: {
          created_at: {
            gte: startDate
          }
        },
        _avg: {
          amount: true
        }
      }),

      // Claims by type
      prisma.claim.groupBy({
        by: ['claim_type'],
        where: {
          created_at: {
            gte: startDate
          }
        },
        _count: {
          id: true
        }
      }),

      // Claims by status
      prisma.claim.groupBy({
        by: ['status'],
        where: {
          created_at: {
            gte: startDate
          }
        },
        _count: {
          id: true
        }
      }),

      // Recent claims (last 5)
      prisma.claim.findMany({
        where: {
          created_at: {
            gte: startDate
          }
        },
        include: {
          principal: {
            select: {
              first_name: true,
              last_name: true,
              enrollee_id: true,
            }
          },
          provider: {
            select: {
              facility_name: true,
            }
          }
        },
        orderBy: { created_at: 'desc' },
        take: 5
      })
    ])

    return NextResponse.json({
      metrics: {
        totalSubmitted,
        pendingClaims,
        approvedClaims,
        rejectedClaims,
        totalAmount: totalAmount._sum.amount || 0,
        averageAmount: averageAmount._avg.amount || 0,
        claimsByType: claimsByType.map(item => ({
          type: item.claim_type,
          count: item._count.id
        })),
        claimsByStatus: claimsByStatus.map(item => ({
          status: item.status,
          count: item._count.id
        })),
        recentClaims: recentClaims.map(claim => ({
          id: claim.id,
          claim_number: claim.claim_number,
          amount: claim.amount,
          status: claim.status,
          created_at: claim.created_at,
          principal_name: claim.principal
            ? `${claim.principal.first_name} ${claim.principal.last_name}`
            : '',
          provider_name: claim.provider?.facility_name || '',
        }))
      }
    })

  } catch (error) {
    console.error('Error fetching claim submission metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch claim submission metrics' },
      { status: 500 }
    )
  }
}
