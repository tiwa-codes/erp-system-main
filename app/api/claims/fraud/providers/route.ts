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
    const search = searchParams.get('search')
    const severity = searchParams.get('severity')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const skip = (page - 1) * limit

    // Build where clause
    const whereClause: any = {}

    if (search) {
      whereClause.provider = {
        facility_name: {
          contains: search,
          mode: 'insensitive'
        }
      }
    }

    if (startDate && endDate) {
      whereClause.created_at = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    // Get providers with suspicious claims
    const providers = await prisma.provider.findMany({
      where: whereClause,
      include: {
        claims: {
          where: {
            fraud_alerts: {
              some: {}
            }
          },
          include: {
            fraud_alerts: true
          }
        }
      },
      skip,
      take: limit,
      orderBy: {
        facility_name: 'asc'
      }
    })

    // Calculate risk scores and suspicious claims
    const suspiciousProviders = providers.map(provider => {
      const suspiciousClaims = provider.claims.length
      const totalFraudAmount = provider.claims.reduce((sum, claim) => {
        return sum + (claim.fraud_alerts.length > 0 ? claim.amount : 0)
      }, 0)

      // Calculate risk score based on number of fraud alerts
      const totalFraudAlerts = provider.claims.reduce((sum, claim) => sum + claim.fraud_alerts.length, 0)
      const riskScore = Math.min(100, Math.round((totalFraudAlerts / Math.max(suspiciousClaims, 1)) * 100))

      // Determine status based on risk score
      let status = 'Low Risk'
      if (riskScore >= 80) status = 'High Risk'
      else if (riskScore >= 60) status = 'Medium Risk'

      return {
        id: provider.id,
        provider_name: provider.facility_name,
        suspicious_claims: suspiciousClaims,
        risk_score: riskScore,
        potential_fraud_amount: totalFraudAmount,
        status: status
      }
    })

    // Filter by severity if specified
    let filteredProviders = suspiciousProviders
    if (severity && severity !== 'all') {
      filteredProviders = suspiciousProviders.filter(provider => {
        if (severity === 'high') return provider.risk_score >= 80
        if (severity === 'medium') return provider.risk_score >= 60 && provider.risk_score < 80
        if (severity === 'low') return provider.risk_score < 60
        return true
      })
    }

    // Get total count for pagination
    const total = await prisma.provider.count({
      where: whereClause
    })

    const pagination = {
      page,
      limit,
      total: filteredProviders.length,
      pages: Math.ceil(filteredProviders.length / limit)
    }

    return NextResponse.json({
      providers: filteredProviders,
      pagination
    })
  } catch (error) {
    console.error('Error fetching suspicious providers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suspicious providers' },
      { status: 500 }
    )
  }
}
