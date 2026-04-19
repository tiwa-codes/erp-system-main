import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, 'telemedicine', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')

    // Build where clause
    const whereClause: any = {
      claim_type: {
        in: ['TELEMEDICINE_LAB', 'TELEMEDICINE_RADIOLOGY', 'TELEMEDICINE_PHARMACY']
      }
    }

    // Add search filter
    if (search) {
      whereClause.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { enrollee_name: { contains: search, mode: "insensitive" } },
        { enrollee_id: { contains: search, mode: "insensitive" } }
      ]
    }

    // Add status filter
    if (status && status !== 'all') {
      whereClause.status = status
    }

    // Fetch claims
    const claims = await prisma.claim.findMany({
      where: whereClause,
      include: {
        enrollee: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true,
          }
        },
        provider: {
          select: {
            id: true,
            facility_name: true,
          }
        }
      },
      orderBy: { created_at: 'desc' }
    })

    // Map claims to include enrollee and provider names
    const mappedClaims = claims.map(claim => ({
      id: claim.id,
      enrollee_id: claim.enrollee_id,
      enrollee_name: claim.enrollee_name || `${claim.enrollee?.first_name || ''} ${claim.enrollee?.last_name || ''}`.trim(),
      provider_id: claim.provider_id,
      provider_name: claim.provider?.facility_name || 'Unknown Provider',
      claim_type: claim.claim_type,
      amount: claim.amount,
      description: claim.description,
      status: claim.status,
      created_at: claim.created_at.toISOString(),
      lab_order_id: claim.lab_order_id,
      radiology_order_id: claim.radiology_order_id,
      pharmacy_order_id: claim.pharmacy_order_id,
    }))

    return NextResponse.json({
      success: true,
      claims: mappedClaims,
      totalCount: mappedClaims.length
    })

  } catch (error) {
    console.error('Error fetching facility claims:', error)
    return NextResponse.json(
      { error: 'Failed to fetch facility claims' },
      { status: 500 }
    )
  }
}
