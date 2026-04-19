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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.OR = [
        { claim_number: { contains: search, mode: 'insensitive' } },
        { principal: { 
          OR: [
            { first_name: { contains: search, mode: 'insensitive' } },
            { last_name: { contains: search, mode: 'insensitive' } },
            { enrollee_id: { contains: search, mode: 'insensitive' } }
          ]
        } },
        { provider: { facility_name: { contains: search, mode: 'insensitive' } } }
      ]
    }

    if (status) {
      where.status = status
    }

    // Fetch claims for investigation
    const claims = await prisma.claim.findMany({
      where,
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
            facility_type: true,
            address: true,
            phone_whatsapp: true,
            email: true
          }
        },
        vetting_records: {
          include: {
            vetter: {
              select: {
                id: true,
                first_name: true,
                last_name: true
              }
            }
          }
        },
        audit_records: {
          include: {
            auditor: {
              select: {
                id: true,
                first_name: true,
                last_name: true
              }
            }
          }
        },
        fraud_alerts: true
      },
      orderBy: { submitted_at: 'desc' },
      skip,
      take: limit
    })

    // Get total count
    const total = await prisma.claim.count({ where })

    return NextResponse.json({
      claims,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching claims for investigation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch claims for investigation' },
      { status: 500 }
    )
  }
}
