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

    // Get investigation trends for last 7 months
    const trends = []
    const currentDate = new Date()
    
    for (let i = 6; i >= 0; i--) {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 0)
      
      const investigations = await prisma.fraudAlert.count({
        where: {
          status: 'RESOLVED',
          created_at: {
            gte: monthStart,
            lte: monthEnd
          }
        }
      })

      trends.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        investigations: investigations
      })
    }

    return NextResponse.json({ trends })
  } catch (error) {
    console.error('Error fetching investigation trends:', error)
    return NextResponse.json(
      { error: 'Failed to fetch investigation trends' },
      { status: 500 }
    )
  }
}
