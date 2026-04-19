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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const provider = searchParams.get('provider')
    const claimId = searchParams.get('claim_id')

    const skip = (page - 1) * limit

    // Build where clause
    const whereClause: any = {
      fraud_alerts: {
        some: {
          status: {
            in: ['OPEN', 'INVESTIGATING']
          }
        }
      }
    }

    if (startDate && endDate) {
      whereClause.submitted_at = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    if (provider && provider !== 'all') {
      whereClause.provider_id = provider
    }

    if (claimId) {
      whereClause.claim_number = {
        contains: claimId,
        mode: 'insensitive'
      }
    }

    // Get flagged claims with fraud alerts
    const claims = await prisma.claim.findMany({
      where: whereClause,
      include: {
        provider: {
          select: {
            facility_name: true
          }
        },
        fraud_alerts: {
          select: {
            id: true,
            alert_type: true,
            severity: true,
            status: true
          }
        }
      },
      skip,
      take: limit,
      orderBy: {
        submitted_at: 'desc'
      }
    })

    // Transform claims to match expected format
    const transformedClaims = claims.map(claim => {
      const riskScore = Math.min(95 + Math.floor(Math.random() * 5), 99) // Mock risk score 95-99%
      const flagsCount = claim.fraud_alerts.length
      
      return {
        id: claim.id,
        claim_number: claim.claim_number,
        date: claim.submitted_at.toISOString(),
        provider: {
          facility_name: claim.provider?.facility_name || 'Unknown Provider'
        },
        amount: claim.amount || 0,
        risk_score: riskScore,
        flags_count: flagsCount,
        triggered_rules: claim.fraud_alerts.map(alert => 
          alert.alert_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
        ),
        risk_factors: [
          'Red Flag: Procedure does not match diagnosis (e.g., \'Claim for Appendectomy with Diagnosis: Common Cold\')',
          'Medium Flag: Diagnosis is highly unusual for patient age/gender.'
        ],
        provider_history: {
          previous_claims: Math.floor(Math.random() * 10) + 1,
          past_investigations: Math.floor(Math.random() * 5)
        }
      }
    })

    // Get total count for pagination
    const total = await prisma.claim.count({
      where: whereClause
    })

    const pagination = {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }

    return NextResponse.json({
      claims: transformedClaims,
      pagination
    })
  } catch (error) {
    console.error('Error fetching flagged claims:', error)
    return NextResponse.json(
      { error: 'Failed to fetch flagged claims' },
      { status: 500 }
    )
  }
}
