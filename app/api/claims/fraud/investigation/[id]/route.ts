import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canAccess = await checkPermission(session.user.role as any, 'claims', 'fraud_detection')
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const claimId = params.id

    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
      include: {
        principal: {
          select: {
            first_name: true,
            last_name: true,
            enrollee_id: true
          }
        },
        provider: {
          select: {
            id: true,
            facility_name: true
          }
        },
        fraud_alerts: {
          select: {
            id: true,
            alert_type: true,
            severity: true,
            description: true,
            status: true,
            created_at: true
          }
        }
      }
    })

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 })
    }

    // Calculate risk score based on fraud alerts
    const riskScore = Math.min(100, claim.fraud_alerts.length * 20)

    // Get triggered rules
    const triggeredRules = claim.fraud_alerts.map(alert => 
      alert.alert_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
    )

    // Generate risk factors based on fraud alerts
    const riskFactors = claim.fraud_alerts.map(alert => {
      switch (alert.alert_type) {
        case 'DUPLICATE_CLAIM':
          return 'High Flag: Duplicate claim detected within short timeframe.'
        case 'SUSPICIOUS_AMOUNT':
          return 'Medium Flag: Claim amount significantly higher than average for this service.'
        case 'PROVIDER_FRAUD':
          return 'Red Flag: Provider has history of fraudulent activities.'
        case 'PATTERN_ANOMALY':
          return 'Medium Flag: Unusual billing pattern detected.'
        default:
          return `Flag: ${alert.alert_type.replace('_', ' ').toLowerCase()}`
      }
    })

    // Get provider history
    const providerClaimsCount = await prisma.claim.count({
      where: { provider_id: claim.provider_id }
    })

    const providerInvestigationsCount = await prisma.fraudAlert.count({
      where: {
        claim: {
          provider_id: claim.provider_id
        }
      }
    })

    const providerHistory = `${claim.provider.facility_name} - previous claims: ${providerClaimsCount} • past investigations: ${providerInvestigationsCount}`

    // Get comments from audit logs
    const comments = await prisma.auditLog.findMany({
      where: {
        resource: 'Claim',
        resource_id: claimId,
        action: 'INVESTIGATION_COMMENT'
      },
      select: {
        new_values: true,
        created_at: true,
        user: {
          select: {
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    const mappedClaim = {
      id: claim.id,
      claim_id: claim.claim_number,
      provider_name: claim.provider.facility_name,
      provider_id: claim.provider_id,
      amount: claim.amount,
      enrollee_name: claim.principal ? 
        `${claim.principal.first_name} ${claim.principal.last_name}` : 
        'Unknown',
      enrollee_id: claim.principal?.enrollee_id || 'N/A',
      service_type: claim.claim_type,
      flags: claim.fraud_alerts.length,
      date: claim.submitted_at.toISOString(),
      risk_score: riskScore,
      triggered_rules: triggeredRules,
      risk_factors: riskFactors,
      provider_history: providerHistory,
      comments: comments.map(c => (c.new_values as any)?.comment || '')
    }

    return NextResponse.json({ claim: mappedClaim })
  } catch (error) {
    console.error('Error fetching investigation claim:', error)
    return NextResponse.json(
      { error: 'Failed to fetch investigation claim' },
      { status: 500 }
    )
  }
}
