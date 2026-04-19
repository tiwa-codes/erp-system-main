import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canDetectFraud = await checkPermission(session.user.role as any, 'claims', 'fraud_detection')
    if (!canDetectFraud) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const providerName = decodeURIComponent(params.provider)

    // Get provider details
    const provider = await prisma.provider.findFirst({
      where: {
        name: {
          contains: providerName,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        phone_number: true,
        email: true
      }
    })

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    // Get provider's claims with fraud alerts
    const claims = await prisma.claim.findMany({
      where: {
        provider_id: provider.id
      },
      include: {
        principal: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true
          }
        },
        fraud_alerts: {
          orderBy: { created_at: 'desc' }
        }
      },
      orderBy: { submitted_at: 'desc' },
      take: 10
    })

    // Calculate risk metrics
    const totalClaims = claims.length
    const flaggedClaims = claims.filter(claim => claim.fraud_alerts.length > 0).length
    const totalFlags = claims.reduce((sum, claim) => sum + claim.fraud_alerts.length, 0)
    const totalAmount = claims.reduce((sum, claim) => sum + Number(claim.amount), 0)

    // Mock risk trend data
    const riskTrend = [
      { date: "Jul 17", last_year: 120, this_year: 150 },
      { date: "Jul 18", last_year: 110, this_year: 140 },
      { date: "Jul 19", last_year: 100, this_year: 90 },
      { date: "Jul 20", last_year: 130, this_year: 160 },
      { date: "Jul 21", last_year: 140, this_year: 250 },
      { date: "Jul 22", last_year: 120, this_year: 180 },
      { date: "Jul 23", last_year: 220, this_year: 200 }
    ]

    // Mock common rules and claim types risk
    const commonRules = [
      "Diagnosis Pattern",
      "Diagnosis Mismatch",
      "Invalid Diagnosis Code",
      "Duplicate claims within 30 days"
    ]

    const claimTypesRisk = [
      { type: "Drugs", risk: 78 },
      { type: "Laboratory", risk: 65 },
      { type: "Radiology", risk: 58 },
      { type: "Procedures", risk: 48 },
      { type: "Emergency", risk: 45 },
      { type: "Therapy", risk: 28 }
    ]

    const profile = {
      id: provider.id,
      name: provider.name,
      location: provider.address || "Unknown",
      flags: totalFlags,
      status: "ACTIVE",
      risk_trend: riskTrend,
      common_rules: commonRules,
      claim_types_risk: claimTypesRisk,
      recent_claims: claims.map(claim => ({
        id: claim.id,
        date: claim.submitted_at.toISOString().split('T')[0],
        enrollee_name: claim.principal ? 
          `${claim.principal.first_name} ${claim.principal.last_name}` : 
          'Unknown Enrollee',
        enrollee_id: claim.enrollee_id,
        amount: Number(claim.amount),
        status: claim.status
      }))
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Error fetching provider risk profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch provider risk profile' },
      { status: 500 }
    )
  }
}
