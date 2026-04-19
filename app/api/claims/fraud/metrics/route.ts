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

    const canAccess = await checkPermission(session.user.role as any, 'claims', 'fraud_detection')
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get current date range (last 3 months)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - 3)

    // Get fraud metrics
    const [
      totalFraudPrevented,
      detectionRate,
      casesInvestigated,
      previousFraudPrevented,
      previousDetectionRate,
      previousCasesInvestigated
    ] = await Promise.all([
      // Total fraud prevented (sum of rejected claims)
      prisma.claim.aggregate({
        where: {
          status: 'REJECTED',
          submitted_at: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          amount: true
        }
      }),

      // Detection rate (percentage of flagged claims)
      prisma.fraudAlert.count({
        where: {
          created_at: {
            gte: startDate,
            lte: endDate
          }
        }
      }),

      // Cases investigated
      prisma.fraudAlert.count({
        where: {
          status: 'RESOLVED',
          created_at: {
            gte: startDate,
            lte: endDate
          }
        }
      }),

      // Previous period metrics for comparison
      prisma.claim.aggregate({
        where: {
          status: 'REJECTED',
          submitted_at: {
            gte: new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime())),
            lt: startDate
          }
        },
        _sum: {
          amount: true
        }
      }),

      prisma.fraudAlert.count({
        where: {
          created_at: {
            gte: new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime())),
            lt: startDate
          }
        }
      }),

      prisma.fraudAlert.count({
        where: {
          status: 'RESOLVED',
          created_at: {
            gte: new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime())),
            lt: startDate
          }
        }
      })
    ])

    // Calculate changes
    const fraudPreventedChange = previousFraudPrevented._sum.amount 
      ? ((totalFraudPrevented._sum.amount || 0) - previousFraudPrevented._sum.amount) / previousFraudPrevented._sum.amount * 100
      : 0

    const detectionRateChange = previousDetectionRate 
      ? ((detectionRate - previousDetectionRate) / previousDetectionRate * 100)
      : 0

    const casesChange = previousCasesInvestigated 
      ? casesInvestigated - previousCasesInvestigated
      : 0

    const metrics = {
      total_fraud_prevented: totalFraudPrevented._sum.amount || 0,
      detection_rate: Math.round((detectionRate / Math.max(detectionRate + casesInvestigated, 1)) * 100),
      cases_investigated: casesInvestigated,
      fraud_prevented_change: Math.round(fraudPreventedChange),
      detection_rate_change: Math.round(detectionRateChange),
      cases_change: casesChange
    }

    return NextResponse.json({ metrics })
  } catch (error) {
    console.error('Error fetching fraud metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fraud metrics' },
      { status: 500 }
    )
  }
}