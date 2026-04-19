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

    const canApprove = await checkPermission(session.user.role as any, 'claims', 'approve')
    if (!canApprove) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get current date range (today)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get metrics
    const [
      totalPending,
      totalApproved,
      totalRejected,
      avgProcessingTime,
      totalClaimsAmount,
      approvedClaimsAmount,
      rejectedClaimsAmount
    ] = await Promise.all([
      // Pending approval claims
      prisma.claim.count({
        where: {
          status: ClaimStatus.VETTING
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
      
      // Average processing time (mock for now)
      Promise.resolve(2.5),

      // Total claims amount
      prisma.claim.aggregate({
        where: {
          status: {
            in: [ClaimStatus.APPROVED, ClaimStatus.REJECTED, ClaimStatus.VETTING]
          }
        },
        _sum: {
          amount: true
        }
      }),

      // Approved claims amount
      prisma.claim.aggregate({
        where: {
          status: ClaimStatus.APPROVED
        },
        _sum: {
          amount: true
        }
      }),

      // Rejected claims amount
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
      total_pending: totalPending,
      total_approved: totalApproved,
      total_rejected: totalRejected,
      avg_processing_time: avgProcessingTime,
      total_amount: totalAmount,
      approved_amount: approvedAmount,
      rejected_amount: rejectedAmount,
      net_amount: netAmount
    }

    return NextResponse.json({ metrics })
  } catch (error) {
    console.error('Error fetching approval metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}
