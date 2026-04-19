import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canAccess = await checkPermission(session.user.role as any, 'claims', 'fraud_detection')
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get existing providers
    const providers = await prisma.provider.findMany({
      take: 5,
      select: { id: true, facility_name: true }
    })

    if (providers.length === 0) {
      return NextResponse.json({ 
        error: 'No providers found. Please create providers first.' 
      }, { status: 400 })
    }

    // Get existing principals
    const principals = await prisma.principalAccount.findMany({
      take: 5,
      select: { id: true, first_name: true, last_name: true }
    })

    if (principals.length === 0) {
      return NextResponse.json({ 
        error: 'No principals found. Please create principals first.' 
      }, { status: 400 })
    }

    // Create test claims with fraud alerts
    const testClaims = []
    const claimNumbers = ['CLM/LH/009', 'CLM/LH/007', 'CLM/LH/013', 'CLM/LH/081', 'CLM/LH/025']

    for (let i = 0; i < 5; i++) {
      const provider = providers[i % providers.length]
      const principal = principals[i % principals.length]
      const claimNumber = claimNumbers[i]
      
      // Create claim
      const claim = await prisma.claim.create({
        data: {
          claim_number: claimNumber,
          amount: Math.floor(Math.random() * 1000000) + 200000, // 200k - 1.2M
          status: 'SUBMITTED',
          claim_type: 'MEDICAL',
          submitted_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Last 7 days
          provider_id: provider.id,
          principal_id: principal.id,
          created_by_id: session.user.id,
          enrollee_id: `ENR${String(i + 1).padStart(3, '0')}`
        }
      })

      // Create fraud alerts for each claim
      const fraudAlertTypes = ['DUPLICATE_CLAIM', 'SUSPICIOUS_AMOUNT', 'PROVIDER_FRAUD', 'PATTERN_ANOMALY']
      const severities = ['HIGH', 'CRITICAL', 'MEDIUM']
      
      const alertCount = Math.floor(Math.random() * 3) + 1 // 1-3 alerts per claim
      
      for (let j = 0; j < alertCount; j++) {
        await prisma.fraudAlert.create({
          data: {
            claim_id: claim.id,
            alert_type: fraudAlertTypes[j % fraudAlertTypes.length],
            severity: severities[j % severities.length],
            description: `Fraud alert ${j + 1} for claim ${claimNumber}`,
            status: 'OPEN',
            created_at: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000) // Last 24 hours
          }
        })
      }

      testClaims.push({
        id: claim.id,
        claim_number: claimNumber,
        provider: provider.facility_name,
        amount: claim.amount,
        alerts_count: alertCount
      })
    }

    return NextResponse.json({
      success: true,
      message: `Created ${testClaims.length} test claims with fraud alerts`,
      claims: testClaims
    })

  } catch (error) {
    console.error('Error creating test fraud data:', error)
    return NextResponse.json(
      { error: 'Failed to create test fraud data' },
      { status: 500 }
    )
  }
}