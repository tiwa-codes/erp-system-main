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

    // Get fraud types with counts
    const fraudTypes = await prisma.fraudAlert.groupBy({
      by: ['alert_type'],
      _count: {
        alert_type: true
      },
      orderBy: {
        _count: {
          alert_type: 'desc'
        }
      },
      take: 7
    })

    // Map to expected format
    const mappedFraudTypes = fraudTypes.map((type, index) => ({
      id: `fraud-type-${index}`,
      name: type.alert_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      count: type._count.alert_type,
      percentage: 0 // Will be calculated on frontend
    }))

    return NextResponse.json({ fraud_types: mappedFraudTypes })
  } catch (error) {
    console.error('Error fetching fraud types:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fraud types' },
      { status: 500 }
    )
  }
}
