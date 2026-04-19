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

    const canAudit = await checkPermission(session.user.role as any, 'operation-desk', 'view', 'audit')
    if (!canAudit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get current date range (today)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get metrics
    const [
      totalAudited,
      pendingAudit,
      flaggedClaims,
      avgAuditTime,
      totalClaimsAmount,
      approvedClaimsAmount,
      rejectedClaimsAmount
    ] = await Promise.all([
      // Total audited claims
      prisma.claim.count({
        where: {
          status: {
            in: [ClaimStatus.APPROVED, ClaimStatus.REJECTED]
          }
        }
      }),
      
      // Pending audit claims
      prisma.claim.count({
        where: {
          current_stage: 'audit',
          status: ClaimStatus.VETTER2_COMPLETED
        }
      }),
      
      // Flagged claims
      prisma.fraudAlert.count({
        where: {
          status: 'OPEN'
        }
      }),
      
      // Average audit time (mock for now)
      Promise.resolve(2.5),
      
      // Total amount of all claims
      prisma.claim.aggregate({
        where: {
          status: {
            in: [ClaimStatus.APPROVED, ClaimStatus.REJECTED, ClaimStatus.VETTER2_COMPLETED]
          }
        },
        _sum: {
          amount: true
        }
      }),
      
      // Total amount of approved claims
      prisma.claim.aggregate({
        where: {
          status: ClaimStatus.APPROVED
        },
        _sum: {
          amount: true
        }
      }),
      
      // Total amount of rejected claims
      prisma.claim.aggregate({
        where: {
          status: ClaimStatus.REJECTED
        },
        _sum: {
          amount: true
        }
      })
    ])

    const totalAmount = totalClaimsAmount._sum.amount || 0
    const approvedAmount = approvedClaimsAmount._sum.amount || 0
    const rejectedAmount = rejectedClaimsAmount._sum.amount || 0
    const netAmount = totalAmount - rejectedAmount

    const metrics = {
      total_audited: totalAudited,
      pending_audit: pendingAudit,
      flagged_claims: flaggedClaims,
      avg_audit_time: avgAuditTime,
      total_amount: totalAmount,
      approved_amount: approvedAmount,
      rejected_amount: rejectedAmount,
      net_amount: netAmount
    }

    return NextResponse.json({ metrics })
  } catch (error) {
    console.error('Error fetching audit metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}
