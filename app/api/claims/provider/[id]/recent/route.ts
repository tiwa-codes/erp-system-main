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

    const canDetectFraud = await checkPermission(session.user.role as any, 'claims', 'fraud_detection')
    if (!canDetectFraud) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // Fetch recent claims from the same provider
    const claims = await prisma.claim.findMany({
      where: {
        provider_id: params.id
      },
      include: {
        principal: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            enrollee_id: true
          }
        },
        provider: {
          select: {
            id: true,
            facility_name: true,
            facility_type: true
          }
        }
      },
      orderBy: { submitted_at: 'desc' },
      take: limit
    })

    return NextResponse.json({ claims })
  } catch (error) {
    console.error('Error fetching recent claims for provider:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recent claims' },
      { status: 500 }
    )
  }
}
