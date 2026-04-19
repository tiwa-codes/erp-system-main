import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { buildClaimSearchOrClauses } from "@/lib/claims-search"
import { ClaimStatus } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canApprove = await checkPermission(session.user.role as any, 'claims', 'approve')
    if (!canApprove) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const provider = searchParams.get('provider') || ''

    const skip = (page - 1) * limit

    // Build where clause for approval - show all providers and their claim statistics
    const where: any = {}

    if (search) {
      where.OR = await buildClaimSearchOrClauses(search)
    }

    if (status && status !== 'all') {
      where.status = status as ClaimStatus
    } else if (!status || status === 'all') {
      // Only show claims that are AUDIT_COMPLETED (pending MD approval from Internal Control)
      // Do NOT show already APPROVED or REJECTED claims
      where.status = ClaimStatus.AUDIT_COMPLETED
    }

    if (provider && provider !== 'all') {
      where.provider_id = provider
    }

    // Get all claims that are at approval stage
    const allClaims = await prisma.claim.findMany({
      where: {
        ...where,
        current_stage: 'approval' // Only show claims at approval stage
      },
      select: {
        id: true,
        claim_number: true,
        status: true,
        amount: true,
        submitted_at: true,
        processed_at: true,
        enrollee_id: true,
        provider_id: true,
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
      }
    })

    // If a specific provider is requested, return individual claims for that provider
    if (provider && provider !== 'all') {
      // Apply the same status filter to provider details
      const providerWhere: any = {
        provider_id: provider,
        current_stage: 'approval' // Only show claims at approval stage
      }

      // If status filter is applied, use it
      if (status && status !== 'all') {
        providerWhere.status = status as ClaimStatus
      } else {
        // Default to AUDIT_COMPLETED (pending MD approval) when no status filter
        providerWhere.status = ClaimStatus.AUDIT_COMPLETED
      }

      const filteredClaims = await prisma.claim.findMany({
        where: providerWhere,
        select: {
          id: true,
          claim_number: true,
          status: true,
          amount: true,
          submitted_at: true,
          processed_at: true,
          enrollee_id: true,
          provider_id: true,
          principal: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              enrollee_id: true,
              primary_hospital: true
            }
          },
          provider: {
            select: {
              id: true,
              facility_name: true,
              facility_type: true
            }
          },
          approval_codes: {
            take: 1,
            select: {
              approval_code: true
            }
          }
        }
      })

      // Batch-fetch provider requests to get encounter codes (request_id)
      const claimIds = filteredClaims.map(c => c.id)
      const providerRequests = await prisma.providerRequest.findMany({
        where: {
          OR: [
            { claim_id: { in: claimIds } },
            { request_id: { in: filteredClaims.map(c => c.claim_number) } }
          ]
        },
        select: {
          claim_id: true,
          request_id: true
        }
      })

      const encounterCodeMap: Record<string, string> = {}
      providerRequests.forEach(pr => {
        if (pr.claim_id) {
          encounterCodeMap[pr.claim_id] = pr.request_id
        }
        encounterCodeMap[pr.request_id] = pr.request_id
      })

      const formattedClaims = filteredClaims.map(claim => ({
        id: claim.id,
        claim_number: claim.claim_number,
        enrollee_name: claim.principal ?
          `${claim.principal.first_name} ${claim.principal.last_name}` :
          'Unknown Enrollee',
        enrollee_id: claim.principal?.enrollee_id || claim.enrollee_id,
        provider_name: claim.provider.facility_name,
        facility_type: claim.provider.facility_type,
        status: claim.status,
        amount: claim.amount,
        submitted_at: claim.submitted_at,
        processed_at: claim.processed_at,
        provider_id: claim.provider_id,
        encounter_code: encounterCodeMap[claim.id] || encounterCodeMap[claim.claim_number] || claim.approval_codes?.[0]?.approval_code,
        is_primary_hospital: claim.provider_id && claim.principal?.primary_hospital ?
          claim.provider?.facility_name?.toLowerCase() === claim.principal.primary_hospital.toLowerCase() :
          true
      }))

      // Apply pagination to individual claims
      const total = formattedClaims.length
      const pages = Math.ceil(total / limit)
      const paginatedClaims = formattedClaims.slice(skip, skip + limit)

      return NextResponse.json({
        success: true,
        claims: paginatedClaims,
        pagination: {
          page,
          limit,
          total,
          pages
        }
      })
    }

    // Group claims by provider and calculate statistics
    const providerStats = allClaims.reduce((acc: any, claim) => {
      const providerId = claim.provider_id
      const providerName = claim.provider.facility_name

      if (!acc[providerId]) {
        acc[providerId] = {
          id: providerId,
          provider_name: providerName,
          facility_type: claim.provider.facility_type,
          total_claims: 0,
          pending_approval: 0,
          approved: 0,
          rejected: 0,
          total_amount: 0,
          latest_claim: null
        }
      }

      const stats = acc[providerId]
      stats.total_claims++
      stats.total_amount += Number(claim.amount || 0)

      // Count by status
      if (claim.status === 'AUDIT_COMPLETED') {
        stats.pending_approval++
      } else if (claim.status === 'APPROVED') {
        stats.approved++
      } else if (claim.status === 'REJECTED') {
        stats.rejected++
      }

      // Keep track of latest claim
      if (!stats.latest_claim || new Date(claim.submitted_at) > new Date(stats.latest_claim.submitted_at)) {
        stats.latest_claim = {
          id: claim.id,
          claim_number: claim.claim_number,
          enrollee_name: claim.principal ?
            `${claim.principal.first_name} ${claim.principal.last_name}` :
            'Unknown Enrollee',
          enrollee_id: claim.principal?.enrollee_id || claim.enrollee_id,
          status: claim.status,
          amount: claim.amount,
          submitted_at: claim.submitted_at,
          provider_id: claim.provider_id
        }
      }

      return acc
    }, {})

    // Convert to array and sort by latest claim date
    const formattedClaims = Object.values(providerStats).sort((a: any, b: any) =>
      new Date(b.latest_claim?.submitted_at || 0).getTime() -
      new Date(a.latest_claim?.submitted_at || 0).getTime()
    )

    // Apply pagination directly to formatted claims
    const total = formattedClaims.length
    const pages = Math.ceil(total / limit)
    const paginatedClaims = formattedClaims.slice(skip, skip + limit)

    return NextResponse.json({
      claims: paginatedClaims,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    })
  } catch (error) {
    console.error('Error fetching approval claims:', error)
    return NextResponse.json(
      { error: 'Failed to fetch claims' },
      { status: 500 }
    )
  }
}
