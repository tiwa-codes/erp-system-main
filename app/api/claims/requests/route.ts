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

    const canView = await checkPermission(session.user.role as any, 'claims', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get user's provider information
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { 
        provider: true,
        role: {
          select: {
            name: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const provider = searchParams.get('provider') || ''
    const startDate = searchParams.get('start_date') || ''
    const endDate = searchParams.get('end_date') || ''

    const skip = (page - 1) * limit

    // Build where clause - filter by user's provider for provider users
    const andClauses: any[] = []
    
    // If user is PROVIDER role, only show claims for their provider
    // SUPER_ADMIN, ADMIN, PROVIDER_MANAGER, and other roles can see all claims
    if (user.role?.name === 'PROVIDER' && user.provider_id) {
      andClauses.push({ provider_id: user.provider_id })
    }

    if (provider && provider !== 'all') {
      andClauses.push({ provider_id: provider })
    }
    
    if (search) {
      andClauses.push({
        OR: [
        { enrollee_id: { contains: search, mode: 'insensitive' } },
        { claim_number: { contains: search, mode: 'insensitive' } },
        { principal: { 
          OR: [
            { first_name: { contains: search, mode: 'insensitive' } },
            { last_name: { contains: search, mode: 'insensitive' } },
            { enrollee_id: { contains: search, mode: 'insensitive' } }
          ]
        }},
        { provider: { facility_name: { contains: search, mode: 'insensitive' } } },
        { approval_codes: { 
          some: {
            OR: [
              { approval_code: { contains: search, mode: 'insensitive' } },
              { services: { contains: search, mode: 'insensitive' } }
            ]
          }
        }}
        ]
      })
    }

    const linkedRequestsByStatus = await prisma.providerRequest.findMany({
      where: {
        ...(user.role?.name === 'PROVIDER' && user.provider_id ? { provider_id: user.provider_id } : {}),
        claim_id: { not: null },
        status: { in: ['REJECTED', 'DELETED'] }
      },
      select: {
        claim_id: true,
        status: true
      },
      distinct: ['claim_id']
    })

    const rejectedLinkedClaimIds = linkedRequestsByStatus
      .filter((request) => request.status === 'REJECTED')
      .map((request) => request.claim_id)
      .filter((claimId): claimId is string => Boolean(claimId))

    const deletedLinkedClaimIds = linkedRequestsByStatus
      .filter((request) => request.status === 'DELETED')
      .map((request) => request.claim_id)
      .filter((claimId): claimId is string => Boolean(claimId))

    // Provider-facing status mapping:
    // - NEW means ready to be sent to Vetter 1
    // - PAID remains PAID
    // - REJECTED remains REJECTED
    // - every in-process vetting status is shown as PENDING
    if (status && status !== 'all') {
      const normalizedStatus = status.toUpperCase()
      if (normalizedStatus === 'NEW') {
        andClauses.push({
          OR: [
            { status: 'NEW' },
            {
              AND: [
                { status: 'SUBMITTED' },
                { approval_codes: { some: { is_manual: true, is_deleted: false } } }
              ]
            }
          ]
        })
        andClauses.push({
          NOT: { approval_codes: { some: { is_deleted: true } } }
        })
        if (rejectedLinkedClaimIds.length > 0) {
          andClauses.push({ id: { notIn: rejectedLinkedClaimIds } })
        }
        if (deletedLinkedClaimIds.length > 0) {
          andClauses.push({ id: { notIn: deletedLinkedClaimIds } })
        }
      } else if (normalizedStatus === 'APPROVED') {
        andClauses.push({ status: 'APPROVED' })
        andClauses.push({
          NOT: { approval_codes: { some: { is_deleted: true } } }
        })
      } else if (normalizedStatus === 'PAID') {
        andClauses.push({ status: 'PAID' })
        andClauses.push({
          NOT: { approval_codes: { some: { is_deleted: true } } }
        })
      } else if (normalizedStatus === 'REJECTED') {
        andClauses.push({
          OR: [
          { status: 'REJECTED' },
          ...(rejectedLinkedClaimIds.length > 0 ? [{ id: { in: rejectedLinkedClaimIds } }] : [])
          ]
        })
        andClauses.push({
          NOT: { approval_codes: { some: { is_deleted: true } } }
        })
      } else if (normalizedStatus === 'PENDING') {
        andClauses.push({ NOT: { status: { in: ['NEW', 'APPROVED', 'PAID', 'REJECTED'] } } })
        andClauses.push({
          NOT: {
            AND: [
              { status: 'SUBMITTED' },
              { approval_codes: { some: { is_manual: true, is_deleted: false } } }
            ]
          }
        })
        andClauses.push({
          NOT: { approval_codes: { some: { is_deleted: true } } }
        })
        if (rejectedLinkedClaimIds.length > 0) {
          andClauses.push({ id: { notIn: rejectedLinkedClaimIds } })
        }
        if (deletedLinkedClaimIds.length > 0) {
          andClauses.push({ id: { notIn: deletedLinkedClaimIds } })
        }
      } else if (normalizedStatus === 'DELETED') {
        andClauses.push({
          OR: [
            { id: { in: deletedLinkedClaimIds.length > 0 ? deletedLinkedClaimIds : ['__no_deleted_claims__'] } },
            { approval_codes: { some: { is_deleted: true } } }
          ]
        })
      }
    }

    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null
      const end = endDate ? new Date(endDate) : null

      if (start) {
        start.setHours(0, 0, 0, 0)
      }
      if (end) {
        end.setHours(23, 59, 59, 999)
      }

      andClauses.push({
        created_at: {
        ...(start ? { gte: start } : {}),
        ...(end ? { lte: end } : {})
        }
      })
    }

    const where = andClauses.length > 0 ? { AND: andClauses } : {}

    const [requests, total] = await Promise.all([
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
          approval_codes: {
            select: {
              approval_code: true,
              is_manual: true,
              is_deleted: true,
              services: true,
              diagnosis: true,
              service_items: {
                select: {
                  service_name: true,
                  service_amount: true,
                  quantity: true
                }
              }
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.claim.count({ where })
    ])

    const claimIds = requests.map((claim) => claim.id)
    const linkedProviderRequests = claimIds.length > 0
      ? await prisma.providerRequest.findMany({
          where: {
            claim_id: { in: claimIds }
          },
          select: {
            claim_id: true,
            status: true,
            rejection_reason: true,
            updated_at: true
          },
          orderBy: {
            updated_at: 'desc'
          }
        })
      : []

    const latestProviderRequestByClaimId = new Map<string, {
      status: string
      rejection_reason: string | null
    }>()
    for (const providerRequest of linkedProviderRequests) {
      if (!providerRequest.claim_id || latestProviderRequestByClaimId.has(providerRequest.claim_id)) {
        continue
      }

      latestProviderRequestByClaimId.set(providerRequest.claim_id, {
        status: providerRequest.status,
        rejection_reason: providerRequest.rejection_reason
      })
    }

    const mapProviderStatus = (rawStatus: string) => {
      if (rawStatus === 'NEW') return 'NEW'
      if (rawStatus === 'APPROVED') return 'APPROVED'
      if (rawStatus === 'PAID') return 'PAID'
      if (rawStatus === 'REJECTED') return 'REJECTED'
      if (rawStatus === 'DELETED') return 'DELETED'
      return 'PENDING'
    }

    // Transform data to match UI requirements
    const transformedRequests = requests
      .map((claim) => {
        const linkedProviderRequest = latestProviderRequestByClaimId.get(claim.id)
        const isManualWaitingClaim =
          claim.status === 'SUBMITTED' &&
          (claim.approval_codes || []).some((code) => code.is_manual && !code.is_deleted)
        const hasDeletedApprovalCode = (claim.approval_codes || []).some((code) => code.is_deleted)
        const isDeletedByLinkedRequest = deletedLinkedClaimIds.includes(claim.id)

        const linkedStatus = linkedProviderRequest?.status?.toUpperCase()
        const effectiveRawStatus =
          linkedStatus === 'DELETED' || hasDeletedApprovalCode || isDeletedByLinkedRequest
            ? 'DELETED'
            : linkedStatus === 'REJECTED'
              ? 'REJECTED'
              : isManualWaitingClaim
                ? 'NEW'
                : claim.status
        const approvalCodes = (claim.approval_codes || [])
          .map((code) => code.approval_code)
          .filter((code): code is string => Boolean(code))

        return {
      id: claim.id,
      approval_code: approvalCodes.length > 0 ? approvalCodes.join(", ") : null,
      enrollee_id: claim.enrollee_id,
      enrollee_name: claim.principal ? 
        `${claim.principal.first_name} ${claim.principal.last_name}` : 
        'Unknown Enrollee', // Show proper name instead of ID
      services: claim.approval_codes?.[0]?.service_items?.length
        ? claim.approval_codes?.[0]?.service_items.map((service) => service.service_name).join(', ')
        : claim.approval_codes?.[0]?.services || 'General Service',
      amount: claim.amount,
      status: mapProviderStatus(effectiveRawStatus),
      raw_status: effectiveRawStatus,
      rejection_reason: linkedProviderRequest?.rejection_reason || claim.rejection_reason,
      date: claim.created_at,
      provider_id: claim.provider_id,
      provider: claim.provider,
      requested_by: 'Provider' // Default for provider requests
        }
      })

    return NextResponse.json({
      requests: transformedRequests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch claims requests' },
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

    const canAdd = await checkPermission(session.user.role as any, 'claims', 'add')
    if (!canAdd) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      enrollee_id,
      principal_id,
      provider_id,
      claim_type,
      amount,
      description,
      services
    } = body

    if (!enrollee_id || !provider_id || !claim_type || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Generate unique claim number
    const claimNumber = `CLM/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(Date.now()).slice(-6)}`

    const claimAmount = parseFloat(amount)
    const newRequest = await prisma.claim.create({
      data: {
        claim_number: claimNumber,
        enrollee_id,
        principal_id: principal_id || null,
        provider_id,
        claim_type: claim_type as any,
        amount: claimAmount,
        original_amount: claimAmount, // Set original amount from provider
        status: 'SUBMITTED',
        current_stage: 'vetter1', // Start at Vetter 1 stage
        created_by_id: session.user.id,
      },
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'CLAIM_REQUEST_CREATE',
        resource: 'claim_request',
        resource_id: newRequest.id,
        new_values: newRequest,
      },
    })

    return NextResponse.json(newRequest, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create claim request' },
      { status: 500 }
    )
  }
}
