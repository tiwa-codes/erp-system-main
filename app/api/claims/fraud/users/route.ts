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

    // Get users who have performed fraud-related actions
    const users = await prisma.user.findMany({
      where: {
        audit_logs: {
          some: {
            OR: [
              { action: 'CLAIM_REJECTED' },
              { action: 'CLAIM_FLAGGED' },
              { action: 'FRAUD_INVESTIGATION' },
              { action: 'CLAIM_APPROVED' },
              { action: 'INVESTIGATION_COMPLETED' }
            ]
          }
        }
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        role: true
      },
      orderBy: {
        first_name: 'asc'
      }
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching fraud users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fraud users' },
      { status: 500 }
    )
  }
}
