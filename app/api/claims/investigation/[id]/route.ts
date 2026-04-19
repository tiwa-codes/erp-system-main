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

    const claim = await prisma.claim.findUnique({
      where: { id: params.id },
      include: {
        principal: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true,
            middle_name: true,
            phone_number: true,
            email: true,
            organization: {
              select: {
                id: true,
                name: true,
                code: true
              }
            },
            plan: {
              select: {
                id: true,
                name: true,
                plan_type: true,
                premium_amount: true,
                annual_limit: true
              }
            }
          }
        },
        provider: {
          select: {
            id: true,
            facility_name: true,
            facility_type: true,
            address: true,
            phone_whatsapp: true,
            email: true
          }
        },
        fraud_alerts: {
          orderBy: { created_at: 'desc' }
        }
      }
    })

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    return NextResponse.json(claim)
  } catch (error) {
    console.error('Error fetching claim for investigation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch claim for investigation' },
      { status: 500 }
    )
  }
}
