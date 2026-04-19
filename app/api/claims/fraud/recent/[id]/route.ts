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

    const providerId = params.id

    // Get recent claims for the provider
    const claims = await prisma.claim.findMany({
      where: { 
        provider_id: providerId,
        fraud_alerts: {
          some: {}
        }
      },
      include: {
        principal: {
          select: {
            first_name: true,
            last_name: true,
            enrollee_id: true
          }
        }
      },
      orderBy: {
        submitted_at: 'desc'
      },
      take: 10
    })

    const mappedClaims = claims.map(claim => ({
      id: claim.id,
      date: claim.submitted_at.toISOString(),
      enrollee_name: claim.principal ? 
        `${claim.principal.first_name} ${claim.principal.last_name}` : 
        'Unknown',
      enrollee_id: claim.principal?.enrollee_id || 'N/A',
      service: claim.claim_type,
      approval_code: claim.claim_number,
      amount: claim.amount,
      status: 'Flagged'
    }))

    return NextResponse.json({ claims: mappedClaims })
  } catch (error) {
    console.error('Error fetching recent claims:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recent claims' },
      { status: 500 }
    )
  }
}
