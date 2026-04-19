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

    // Get a random claim to add fraud alerts to
    const claim = await prisma.claim.findFirst({
      where: {
        fraud_alerts: {
          none: {}
        }
      },
      orderBy: {
        submitted_at: 'desc'
      }
    })

    if (!claim) {
      return NextResponse.json({ error: 'No claims found to add fraud alerts to' }, { status: 404 })
    }

    // Create fraud alerts for the claim
    const fraudAlerts = await Promise.all([
      prisma.fraudAlert.create({
        data: {
          claim_id: claim.id,
          alert_type: 'DUPLICATE_CLAIM',
          severity: 'HIGH',
          description: 'Duplicate claim detected within 30 days',
          status: 'OPEN',
          created_at: new Date()
        }
      }),
      prisma.fraudAlert.create({
        data: {
          claim_id: claim.id,
          alert_type: 'SUSPICIOUS_AMOUNT',
          severity: 'MEDIUM',
          description: 'Claim amount significantly higher than average',
          status: 'OPEN',
          created_at: new Date()
        }
      }),
      prisma.fraudAlert.create({
        data: {
          claim_id: claim.id,
          alert_type: 'PATTERN_ANOMALY',
          severity: 'LOW',
          description: 'Unusual billing pattern detected',
          status: 'OPEN',
          created_at: new Date()
        }
      })
    ])

    return NextResponse.json({ 
      success: true,
      claim_id: claim.id,
      fraud_alerts_created: fraudAlerts.length,
      message: `Created ${fraudAlerts.length} fraud alerts for claim ${claim.claim_number}`
    })
  } catch (error) {
    console.error('Error creating test fraud data:', error)
    return NextResponse.json(
      { error: 'Failed to create test fraud data' },
      { status: 500 }
    )
  }
}
