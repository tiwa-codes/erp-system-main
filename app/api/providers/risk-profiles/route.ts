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

    const canViewProviders = await checkPermission(session.user.role as any, 'provider', 'view')
    if (!canViewProviders) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const risk_level = searchParams.get('risk_level') || ''

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.provider = {
        facility_name: { contains: search, mode: 'insensitive' }
      }
    }

    if (risk_level && risk_level !== 'all') {
      where.risk_level = risk_level
    }

    const [risk_profiles, total] = await Promise.all([
      prisma.providerRiskProfile.findMany({
        where,
        include: {
          provider: {
            select: {
              id: true,
              facility_name: true,
              facility_type: true
            }
          }
        },
        orderBy: { assessment_date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.providerRiskProfile.count({ where })
    ])

    return NextResponse.json({
      risk_profiles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching provider risk profiles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch provider risk profiles' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canAddProviders = await checkPermission(session.user.role as any, 'provider', 'add')
    if (!canAddProviders) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      provider_id,
      risk_score,
      risk_level,
      assessment_date,
      factors,
      recommendations
    } = body

    if (!provider_id || !risk_score || !risk_level || !assessment_date) {
      return NextResponse.json({ error: 'Provider ID, risk score, risk level, and assessment date are required' }, { status: 400 })
    }

    // Verify provider exists
    const provider = await prisma.provider.findUnique({
      where: { id: provider_id }
    })

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    const riskProfile = await prisma.providerRiskProfile.create({
      data: {
        provider_id,
        risk_score,
        risk_level,
        assessment_date: new Date(assessment_date),
        factors,
        recommendations
      }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PROVIDER_RISK_ASSESSMENT_CREATE',
        resource: 'provider_risk_profile',
        resource_id: riskProfile.id,
        new_values: {
          provider_id,
          risk_score,
          risk_level,
          assessment_date,
          factors,
          recommendations
        },
      },
    })

    return NextResponse.json(riskProfile, { status: 201 })
  } catch (error) {
    console.error('Error creating provider risk profile:', error)
    return NextResponse.json(
      { error: 'Failed to create provider risk profile' },
      { status: 500 }
    )
  }
}
