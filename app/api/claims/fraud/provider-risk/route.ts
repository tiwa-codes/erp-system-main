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

    const canDetectFraud = await checkPermission(session.user.role as any, 'claims', 'fraud_detection')
    if (!canDetectFraud) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get provider risk data
    const providerRiskData = await prisma.fraudAlert.groupBy({
      by: ['claim'],
      where: {
        status: 'OPEN'
      },
      _count: {
        id: true
      },
      _sum: {
        claim: {
          amount: true
        }
      }
    })

    // Get provider details
    const providers = await prisma.provider.findMany({
      select: {
        id: true,
        name: true,
        code: true
      }
    })

    // Calculate risk scores for each provider
    const providerRisk = providers.map(provider => {
      const providerClaims = providerRiskData.filter(item => 
        item.claim?.provider?.name === provider.name
      )
      
      const suspiciousClaims = providerClaims.reduce((sum, item) => sum + item._count.id, 0)
      const potentialFraudAmount = providerClaims.reduce((sum, item) => 
        sum + (item._sum.claim?.amount || 0), 0
      )
      
      // Calculate risk score based on suspicious claims count
      const riskScore = Math.min(100, Math.max(0, suspiciousClaims * 10))
      
      return {
        provider_name: provider.name,
        suspicious_claims: suspiciousClaims,
        risk_score: riskScore,
        potential_fraud_amount: potentialFraudAmount,
        status: riskScore >= 80 ? 'HIGH' : riskScore >= 60 ? 'MEDIUM' : 'LOW'
      }
    }).sort((a, b) => b.risk_score - a.risk_score)

    return NextResponse.json({ providers: providerRisk })
  } catch (error) {
    console.error('Error fetching provider risk data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch provider risk data' },
      { status: 500 }
    )
  }
}
