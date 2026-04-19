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

    // Get current date range (last 30 days)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    // Get metrics
    const [
      totalClaims,
      newClaims,
      pendingClaims,
      approvedClaims,
      rejectedClaims,
      paidClaims,
      vettedClaims,
      flaggedClaims,
      totalAmount
    ] = await Promise.all([
      // Total claims
      prisma.claim.count(),

      // New claims
      prisma.claim.count({
        where: {
          status: ClaimStatus.NEW
        }
      }),
      
      // Pending claims (submitted, under_review, vetting)
      prisma.claim.count({
        where: {
          status: {
            in: [ClaimStatus.PENDING, ClaimStatus.SUBMITTED, ClaimStatus.UNDER_REVIEW, ClaimStatus.VETTING]
          }
        }
      }),

      // Approved claims
      prisma.claim.count({
        where: {
          status: ClaimStatus.APPROVED
        }
      }),

      // Rejected claims
      prisma.claim.count({
        where: {
          status: ClaimStatus.REJECTED
        }
      }),

      // Paid claims
      prisma.claim.count({
        where: {
          status: ClaimStatus.PAID
        }
      }),
      
      // Vetted claims (approved, rejected, paid)
      prisma.claim.count({
        where: {
          status: {
            in: [ClaimStatus.APPROVED, ClaimStatus.REJECTED, ClaimStatus.PAID]
          }
        }
      }),
      
      // Flagged claims (fraud alerts)
      prisma.fraudAlert.count({
        where: {
          status: 'OPEN'
        }
      }),
      
      // Total amount
      prisma.claim.aggregate({
        _sum: {
          amount: true
        }
      })
    ])

    // Calculate approval rate
    const processedClaims = vettedClaims
    const approvalRate = processedClaims > 0 ? Math.round((approvedClaims / processedClaims) * 100 * 10) / 10 : 0

    const metrics = {
      total_claims: totalClaims,
      new_claims: newClaims,
      pending_claims: pendingClaims,
      approved_claims: approvedClaims,
      rejected_claims: rejectedClaims,
      paid_claims: paidClaims,
      total_claims_paid: paidClaims, // Alias used by some provider-facing reports
      vetted_claims: vettedClaims,
      flagged_claims: flaggedClaims,
      total_amount: totalAmount._sum.amount || 0,
      approval_rate: approvalRate
    }

    return NextResponse.json({ metrics })
  } catch (error) {
    console.error('Error fetching claims metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}
