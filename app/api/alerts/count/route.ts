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

    // Count alerts
    const count = await prisma.fraudAlert.count({ where })

    return NextResponse.json({ count })
  } catch (error) {
    console.error('Error counting alerts:', error)
    return NextResponse.json(
      { error: 'Failed to count alerts' },
      { status: 500 }
    )
  }
}
