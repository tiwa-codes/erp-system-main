import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { ClaimStatus } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canVet = await checkPermission(session.user.role as any, 'claims', 'vet')
    if (!canVet) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const provider = searchParams.get('provider') || ''

    const skip = (page - 1) * limit

    // Build where clause for vetting - show all claims for report analysis
    const where: any = {}
    
    if (search) {
      where.OR = [
        { claim_number: { contains: search, mode: 'insensitive' } },
        { enrollee_id: { contains: search, mode: 'insensitive' } },
        { principal: { 
          OR: [
            { first_name: { contains: search, mode: 'insensitive' } },
            { last_name: { contains: search, mode: 'insensitive' } }
          ]
        }},
        { provider: { facility_name: { contains: search, mode: 'insensitive' } } }
      ]
    }

    if (status && status !== 'all') {
      where.status = status as ClaimStatus
    } else if (!status || status === 'all') {
      // Default to showing pending claims when no status filter is applied
      where.status = {
        in: [ClaimStatus.PENDING, ClaimStatus.SUBMITTED, ClaimStatus.UNDER_REVIEW, ClaimStatus.VETTING]
      }
    }

    if (provider && provider !== 'all') {
      where.provider_id = provider
    }

    const [claims, total] = await Promise.all([
      prisma.claim.findMany({
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
              facility_type: true
            }
          },
          vetting_records: {
            orderBy: { created_at: 'desc' },
            take: 1
          }
        },
        orderBy: { submitted_at: 'desc' }, // Show newest first
        skip,
        take: limit,
      }),
      prisma.claim.count({ where })
    ])

    // Fetch services for each claim from ProviderRequest
    const claimsWithServices = await Promise.all(
      claims.map(async (claim) => {
        // Find the most recent ProviderRequest for this enrollee and provider
        const providerRequest = await prisma.providerRequest.findFirst({
          where: {
            enrollee_id: claim.enrollee_id,
            provider_id: claim.provider_id
          },
          orderBy: { created_at: 'desc' },
          select: {
            services: true,
            diagnosis: true,
            hospital: true
          }
        })

        return {
          ...claim,
          services: providerRequest?.services || claim.claim_type,
          diagnosis: providerRequest?.diagnosis || null,
          hospital: providerRequest?.hospital || claim.provider.facility_name
        }
      })
    )

    return NextResponse.json({
      claims: claimsWithServices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching vetter claims:', error)
    return NextResponse.json(
      { error: 'Failed to fetch claims' },
      { status: 500 }
    )
  }
}
