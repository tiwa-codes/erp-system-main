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

    const canViewClaims = await checkPermission(session.user.role as any, 'claims', 'view')
    if (!canViewClaims) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const isRead = searchParams.get('isRead')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Build where clause
    const where: any = {}
    
    if (isRead !== null) {
      where.is_read = isRead === 'true'
    }
    
    // Map status values to valid enum values
    if (status) {
      // Map common status values to valid FraudStatus enum values
      const statusMap: { [key: string]: string } = {
        'active': 'OPEN',
        'open': 'OPEN',
        'investigating': 'INVESTIGATING',
        'resolved': 'RESOLVED',
        'false_positive': 'FALSE_POSITIVE',
        'false-positive': 'FALSE_POSITIVE'
      }
      
      const mappedStatus = statusMap[status.toLowerCase()] || status.toUpperCase()
      where.status = mappedStatus
    }

    // Fetch alerts
    const alerts = await prisma.fraudAlert.findMany({
      where,
      include: {
        claim: {
          select: {
            id: true,
            claim_number: true,
            amount: true,
            principal: {
              select: {
                first_name: true,
                last_name: true,
                enrollee_id: true
              }
            },
            provider: {
              select: {
                facility_name: true
              }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: limit
    })

    return NextResponse.json({ alerts })
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    )
  }
}
