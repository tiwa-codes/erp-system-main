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

    const canVet = await checkPermission(session.user.role as any, 'claims', 'vet')
    if (!canVet) {
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
      totalVetted,
      totalFlagged,
      avgProcessingTime,
      totalClaimsAmount,
      approvedClaimsAmount,
      rejectedClaimsAmount
    ] = await Promise.all([
      // Total pending claims
      prisma.claim.count({
        where: {
          status: {
            in: [ClaimStatus.SUBMITTED, ClaimStatus.UNDER_REVIEW, ClaimStatus.VETTING]
          }
        }
      }),
      
      // Total vetted today
      prisma.claim.count({
        where: {
          status: {
            in: [ClaimStatus.APPROVED, ClaimStatus.REJECTED]
          },
          processed_at: {
            gte: today,
            lt: tomorrow
          }
        }
      }),
      
      // Total flagged claims
      prisma.fraudAlert.count({
        where: {
          status: 'OPEN'
        }
      }),
      
      // Average processing time (in hours) - using mock data for now
      Promise.resolve({ _avg: { completed_at: null } }),

      // Total claims amount
      prisma.claim.aggregate({
        where: {
          status: {
            in: [ClaimStatus.SUBMITTED, ClaimStatus.UNDER_REVIEW, ClaimStatus.VETTING, ClaimStatus.APPROVED, ClaimStatus.REJECTED]
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

    const totalAmount = Number(totalClaimsAmount._sum.amount || 0)
    const approvedAmount = Number(approvedClaimsAmount._sum.amount || 0)
    const rejectedAmount = Number(rejectedClaimsAmount._sum.amount || 0)
    const netAmount = totalAmount - rejectedAmount

    const metrics = {
      total_pending: totalPending,
      total_vetted: totalVetted,
      total_flagged: totalFlagged,
      avg_processing_time: avgProcessingTime._avg.completed_at ? 2.5 : 0, // Mock for now
      total_amount: totalAmount,
      approved_amount: approvedAmount,
      rejected_amount: rejectedAmount,
      net_amount: netAmount
    }

    return NextResponse.json({ metrics })
  } catch (error) {
    console.error('Error fetching vetter metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}
