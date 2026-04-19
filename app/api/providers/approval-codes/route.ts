import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import { getAddServiceWindowMeta } from '@/lib/add-service-window'

const parseServices = (raw: string | null | undefined) => {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const isPrimaryAutoApprovedCode = (services: any[], diagnosis?: string | null) => {
  if ((diagnosis || "").match(/Additional services for approval code:/i)) return false
  if (!services.length) return false

  return services.every((service) => {
    if (service?.is_primary === true) return true
    return Number(service?.service_type) === 1
  })
}

const buildFullName = (firstName?: string | null, lastName?: string | null) =>
  `${firstName || ''} ${lastName || ''}`.trim()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, 'provider', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get user's provider information
    let user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        provider: true,
        role: true
      }
    })

    if (!user) {
      return NextResponse.json({
        error: 'User not found in database',
        debug: {
          sessionUserId: session.user.id,
          sessionUserEmail: session.user.email
        }
      }, { status: 404 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const startDate = searchParams.get('start_date') || ''
    const endDate = searchParams.get('end_date') || ''

    const skip = (page - 1) * limit

    // Build where clause for approval codes
    const whereClause: any = {
      // EXCLUDE encounter codes - only show approval codes (APR/)
      approval_code: {
        startsWith: 'APR'
      }
    }

    console.log('🔍 User role:', user.role?.name)
    console.log('🔍 User provider_id:', user.provider_id)
    console.log('🔍 User provider:', user.provider?.facility_name)

    // Filter by user's provider if they are a PROVIDER role (not ADMIN/SUPER_ADMIN)
    if (user.role?.name === 'PROVIDER') {
      if (!user.provider_id || !user.provider) {
        // Return empty array with warning message instead of error
        return NextResponse.json({
          success: true,
          approval_codes: [],
          pagination: {
            page: 1,
            limit: limit,
            total: 0,
            pages: 0
          },
          warning: 'Your account is not linked to a provider facility. Please contact the administrator.'
        })
      }
      whereClause.hospital = user.provider.facility_name
      console.log('🔍 Filtering by hospital:', whereClause.hospital)
    } else {
      console.log('🔍 SUPER_ADMIN/ADMIN - showing all approval codes')
    }

    console.log('🔍 Final where clause:', JSON.stringify(whereClause, null, 2))

    const approvalCodeWhere: any = {
      ...whereClause,
      is_deleted: false,
      ...(search ? {
        OR: [
          { hospital: { contains: search, mode: 'insensitive' } },
          { enrollee_id: { contains: search, mode: 'insensitive' } },
          { approval_code: { contains: search, mode: 'insensitive' } }
        ]
      } : {}),
      ...(status && status !== 'all' ? {
        status: status as any
      } : {
        status: {
          in: ['PENDING', 'APPROVED', 'PARTIAL', 'REJECTED'] as any[]
        }
      }),
      ...(startDate || endDate ? {
        created_at: {
          ...(startDate ? { gte: new Date(startDate) } : {}),
          ...(endDate ? { lte: new Date(endDate) } : {})
        }
      } : {})
    }

    // Fetch all matching approval codes first; we'll merge with pending provider requests and paginate in-memory
    const approvalCodes = await prisma.approvalCode.findMany({
      where: approvalCodeWhere,
      include: {
        service_items: {
          select: {
            service_name: true,
            service_amount: true,
            quantity: true
          }
        },
        enrollee: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true,
            plan: {
              select: {
                id: true,
                name: true,
                assigned_bands: true,
                band_type: true
              }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    })

    const approvalCodeIds = approvalCodes.map(code => code.id)
    const approvalTimelines = approvalCodeIds.length > 0
      ? await prisma.approvalCodeTimeline.findMany({
        where: {
          approval_code_id: { in: approvalCodeIds },
          stage: 'APPROVED'
        },
        orderBy: { timestamp: 'asc' },
        select: {
          approval_code_id: true,
          timestamp: true
        }
      })
      : []

    const approvedAtByCodeId = new Map<string, Date>()
    for (const timeline of approvalTimelines) {
      if (!approvedAtByCodeId.has(timeline.approval_code_id)) {
        approvedAtByCodeId.set(timeline.approval_code_id, timeline.timestamp)
      }
    }

    // Fetch rejection reasons for REJECTED approval codes from related ProviderRequests
    const rejectionReasonMap = new Map<string, string>()
    const rejectionOverrideMap = new Map<string, {
      status: 'REJECTED'
      reason: string | null
      services: any[]
    }>()

    if (approvalCodes.length > 0) {
      try {
        const codeEnrolleeIds = [...new Set(approvalCodes.map(ac => ac.enrollee_id))]
        const providerRequests = await prisma.providerRequest.findMany({
          where: {
            status: 'REJECTED',
            enrollee_id: { in: codeEnrolleeIds }
          },
          select: {
            claim_id: true,
            enrollee_id: true,
            hospital: true,
            diagnosis: true,
            services: true,
            rejection_reason: true,
            created_at: true
          },
          orderBy: { created_at: 'desc' }
        })

        for (const code of approvalCodes) {
          const matchingRequest = providerRequests.find((pr) => {
            if (pr.enrollee_id !== code.enrollee_id) return false
            if (pr.claim_id && code.claim_id && pr.claim_id === code.claim_id) return true
            if (pr.diagnosis && code.approval_code && pr.diagnosis.toLowerCase().includes(code.approval_code.toLowerCase())) {
              return true
            }
            return pr.hospital === code.hospital && code.status === 'REJECTED'
          })

          if (!matchingRequest) continue

          let reason = matchingRequest.rejection_reason
          if (reason) {
            try {
              const parsed = JSON.parse(reason)
              if (parsed.overall_remarks) reason = parsed.overall_remarks
            } catch { /* plain string, use as-is */ }
          }

          if (reason) {
            rejectionReasonMap.set(code.id, reason)
          }

          const parsedServices = parseServices(matchingRequest.services)
          const isAddServiceRejection =
            /Additional services for approval code:/i.test(matchingRequest.diagnosis || '') ||
            parsedServices.some((service: any) =>
              service?.is_added_after_approval === true || service?.is_added_later === true
            )

          if (!isAddServiceRejection && parsedServices.length > 0) {
            rejectionOverrideMap.set(code.id, {
              status: 'REJECTED',
              reason: reason || null,
              services: parsedServices
            })
          }
        }
      } catch (err) {
        console.error('Error fetching rejection reasons:', err)
      }
    }

    // Debug logging to see what approval codes are found
    console.log('🔍 Approval Codes Query Results:', {
      totalFound: approvalCodes.length,
      totalCount: approvalCodes.length,
      approvalCodes: approvalCodes.map(ac => ({
        id: ac.id,
        approval_code: ac.approval_code,
        hospital: ac.hospital,
        provider_id: ac.provider_id,
        status: ac.status,
        created_at: ac.created_at
      }))
    })

    console.log('🔍 Approval Codes Found:', {
      totalApprovalCodes: approvalCodes.length,
      approvalCodeIds: approvalCodes.map(ac => ac.id),
      approvalCodeStatuses: approvalCodes.map(ac => ({ id: ac.id, status: ac.status, created_at: ac.created_at })),
      todayApprovalCodes: approvalCodes.filter(ac => {
        const today = new Date()
        const approvalCodeDate = new Date(ac.created_at)
        return approvalCodeDate.toDateString() === today.toDateString()
      }).length
    })

    const hospitals = approvalCodes
      .filter(code => !code.provider_id && code.hospital)
      .map(code => code.hospital)

    const providersByHospital = hospitals.length > 0
      ? await prisma.provider.findMany({
        where: {
          facility_name: { in: hospitals }
        },
        select: { id: true, facility_name: true }
      })
      : []

    const providerIdByHospital = new Map(
      providersByHospital.map(provider => [provider.facility_name, provider.id])
    )

    const dependentIdsToResolve = Array.from(
      new Set(
        approvalCodes
          .map((approvalCode) => (approvalCode as any).beneficiary_id)
          .filter((beneficiaryId): beneficiaryId is string => typeof beneficiaryId === 'string' && beneficiaryId.trim().length > 0)
      )
    )

    const dependents = dependentIdsToResolve.length > 0
      ? await prisma.dependent.findMany({
          where: {
            dependent_id: { in: dependentIdsToResolve }
          },
          select: {
            dependent_id: true,
            first_name: true,
            last_name: true
          }
        })
      : []

    const dependentNameById = new Map(
      dependents.map((dependent) => [
        dependent.dependent_id,
        buildFullName(dependent.first_name, dependent.last_name)
      ])
    )

    // Determine which APPROVED/PARTIAL codes have a linked pending add-service request
    const pendingCheckCodes = approvalCodes.filter(ac => ac.status === 'APPROVED' || ac.status === 'PARTIAL')
    const pendingServicesSet = new Set<string>() // approval code DB IDs
    if (pendingCheckCodes.length > 0) {
      try {
        const enrolleeIds = pendingCheckCodes.map(ac => ac.enrollee_id)
        const linkedPending = await prisma.providerRequest.findMany({
          where: {
            status: 'PENDING',
            enrollee_id: { in: enrolleeIds }
          },
          select: { id: true, claim_id: true, diagnosis: true, enrollee_id: true }
        })
        for (const pr of linkedPending) {
          for (const ac of pendingCheckCodes) {
            if (pr.claim_id && ac.claim_id && pr.claim_id === ac.claim_id) {
              pendingServicesSet.add(ac.id); break
            }
            if (pr.diagnosis && ac.approval_code &&
                pr.diagnosis.toLowerCase().includes(ac.approval_code.toLowerCase())) {
              pendingServicesSet.add(ac.id); break
            }
          }
        }
      } catch (err) {
        console.error('Error checking pending add-service requests:', err)
      }
    }

    // Format approval codes for response with band information
    const approvalCodesFormatted = approvalCodes.map(approvalCode => {
      const addServiceWindow = getAddServiceWindowMeta({
        createdAt: approvalCode.created_at,
        approvedAt: approvedAtByCodeId.get(approvalCode.id) || null
      })
      const providerId = approvalCode.provider_id || providerIdByHospital.get(approvalCode.hospital) || null
      const rejectionOverride = rejectionOverrideMap.get(approvalCode.id)
      // Determine enrollee's band(s) - handle case where enrollee relation might not exist
      const enrolleeBands = approvalCode.enrollee?.plan?.assigned_bands && approvalCode.enrollee.plan.assigned_bands.length > 0
        ? approvalCode.enrollee.plan.assigned_bands
        : (approvalCode.enrollee?.plan?.band_type ? [approvalCode.enrollee.plan.band_type] : ["Band A"])

      const approvedServices = rejectionOverride
        ? rejectionOverride.services
        : (approvalCode.service_items?.length ? approvalCode.service_items : approvalCode.services)
      const allStoredServices = parseServices(approvalCode.services)
      const isPrimaryAutoApproved = isPrimaryAutoApprovedCode(
        allStoredServices,
        (approvalCode as any).diagnosis || null
      )

      const beneficiaryId = (approvalCode as any).beneficiary_id as string | null | undefined
      const liveDependentName = beneficiaryId ? dependentNameById.get(beneficiaryId) || null : null
      const livePrincipalName = buildFullName(approvalCode.enrollee?.first_name, approvalCode.enrollee?.last_name)
      const displayName = liveDependentName || livePrincipalName || (approvalCode as any).enrollee_name || ''
      // Prefer beneficiary_id (dependent's enrollee ID) over the principal's enrollee_id
      const displayEnrolleeId = (approvalCode as any).beneficiary_id ||
        approvalCode.enrollee?.enrollee_id || approvalCode.enrollee_id
      const nameParts = displayName.split(' ')
      const displayFirstName = nameParts[0] || approvalCode.enrollee?.first_name || ''
      const displayLastName = nameParts.slice(1).join(' ') || approvalCode.enrollee?.last_name || ''

      return {
        id: approvalCode.id,
        approval_code: approvalCode.approval_code,
        hospital: approvalCode.hospital,
        provider_id: providerId,
        enrollee_name: displayName,
        enrollee_id: displayEnrolleeId,
        enrollee_plan: approvalCode.enrollee?.plan?.name || 'No Plan',
        enrollee_bands: enrolleeBands,
        services: approvedServices || 'General Service',
        all_services: JSON.stringify(rejectionOverride?.services || parseServices(approvalCode.services)) || null,
        amount: rejectionOverride ? 0 : (approvalCode.amount || 0),
        status: rejectionOverride?.status || approvalCode.status,
        rejection_reason: rejectionOverride?.reason || rejectionReasonMap.get(approvalCode.id) || null,
        date: approvalCode.created_at,
        is_primary_auto_approved: isPrimaryAutoApproved,
        add_service_window_started_at: addServiceWindow.windowStartedAt?.toISOString() || null,
        add_service_expires_at: addServiceWindow.expiresAt?.toISOString() || null,
        add_service_seconds_remaining: addServiceWindow.remainingSeconds,
        add_service_window_expired: addServiceWindow.isExpired,
        // Add provider information for frontend compatibility
        provider: {
          id: providerId || approvalCode.hospital,
          facility_name: approvalCode.hospital,
          facility_type: 'HOSPITAL' // Default facility type
        },
        enrollee: {
          id: approvalCode.enrollee?.id,
          first_name: displayFirstName,
          last_name: displayLastName,
          enrollee_id: displayEnrolleeId,
          plan: approvalCode.enrollee?.plan,
          bands: enrolleeBands
        },
        band_summary: {
          total_bands: enrolleeBands.length,
          bands: enrolleeBands,
          message: `Enrollee has access to providers under ${enrolleeBands.length} band(s): ${enrolleeBands.join(", ")}`
        },
        has_pending_services: pendingServicesSet.has(approvalCode.id),
        source_type: 'approval_code'
      }
    })

    // Include pending provider requests that may not yet have an approval code record
    const includePendingRequests = status === 'all' || status === '' || status.toUpperCase() === 'PENDING'
    let pendingRequestRows: any[] = []
    if (includePendingRequests) {
      const pendingRequestWhere: any = {
        status: 'PENDING',
        ...(user.role?.name === 'PROVIDER' && user.provider_id ? { provider_id: user.provider_id } : {}),
        ...(search ? {
          OR: [
            { hospital: { contains: search, mode: 'insensitive' } },
            { enrollee_id: { contains: search, mode: 'insensitive' } },
            { services: { contains: search, mode: 'insensitive' } },
            { request_id: { contains: search, mode: 'insensitive' } }
          ]
        } : {}),
        ...(startDate || endDate ? {
          created_at: {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate ? { lte: new Date(endDate) } : {})
          }
        } : {})
      }

      const pendingRequests = await prisma.providerRequest.findMany({
        where: pendingRequestWhere,
        include: {
          provider: {
            select: {
              id: true,
              facility_name: true,
              facility_type: true
            }
          },
          enrollee: {
            select: {
              id: true,
              enrollee_id: true,
              first_name: true,
              last_name: true,
              plan: {
                select: {
                  id: true,
                  name: true,
                  assigned_bands: true,
                  band_type: true
                }
              }
            }
          },
          request_items: {
            select: {
              service_name: true
            }
          }
        },
        orderBy: { created_at: 'desc' }
      })

      const existingApprovalCodes = new Set(
        approvalCodesFormatted
          .map((row: any) => (row.approval_code || '').trim())
          .filter(Boolean)
      )

      const approvalCodeByClaimId = new Map<string, string>()
      approvalCodes.forEach((code) => {
        if (code.claim_id) {
          approvalCodeByClaimId.set(code.claim_id, code.approval_code)
        }
      })

      pendingRequestRows = pendingRequests
        .filter((req) => {
          const diagnosisReferencedCode = req.diagnosis
            ? (req.diagnosis.match(/Additional services for approval code:\s*([A-Z0-9\/-]+)/i)?.[1] || null)
            : null

          if (diagnosisReferencedCode && existingApprovalCodes.has(diagnosisReferencedCode)) {
            return false
          }

          if (req.claim_id) {
            const claimLinkedCode = approvalCodeByClaimId.get(req.claim_id)
            if (claimLinkedCode && existingApprovalCodes.has(claimLinkedCode)) {
              return false
            }
          }

          return true
        })
        .map((req) => {
          const diagnosisReferencedCode = req.diagnosis
            ? (req.diagnosis.match(/Additional services for approval code:\s*([A-Z0-9\/-]+)/i)?.[1] || null)
            : null

          const enrolleeBands = req.enrollee?.plan?.assigned_bands && req.enrollee.plan.assigned_bands.length > 0
            ? req.enrollee.plan.assigned_bands
            : (req.enrollee?.plan?.band_type ? [req.enrollee.plan.band_type] : ["Band A"])

          const liveDependentName = req.beneficiary_id
            ? dependentNameById.get(req.beneficiary_id) || null
            : null
          const enrolleeDisplayName = buildFullName(req.enrollee?.first_name, req.enrollee?.last_name)
          const displayName = liveDependentName || req.beneficiary_name || enrolleeDisplayName
          const displayEnrolleeId = req.beneficiary_id || req.enrollee?.enrollee_id || req.enrollee_id

          const summarizedServices = req.request_items?.length
            ? req.request_items.map((item) => item.service_name)
            : req.services || 'General Service'

          return {
            id: req.id,
            approval_code: diagnosisReferencedCode || null,
            hospital: req.hospital || req.provider?.facility_name || 'Unknown Hospital',
            provider_id: req.provider_id,
            enrollee_name: displayName,
            enrollee_id: displayEnrolleeId,
            enrollee_plan: req.enrollee?.plan?.name || 'No Plan',
            enrollee_bands: enrolleeBands,
            services: summarizedServices,
            all_services: req.services || null,
            amount: Number(req.amount) || 0,
            status: 'PENDING',
            rejection_reason: null,
            date: req.created_at,
            provider: {
              id: req.provider?.id || req.provider_id,
              facility_name: req.provider?.facility_name || req.hospital || 'Unknown Provider',
              facility_type: req.provider?.facility_type || 'HOSPITAL'
            },
            enrollee: {
              id: req.enrollee?.id,
              first_name: displayName.split(' ')[0] || req.enrollee?.first_name || '',
              last_name: displayName.split(' ').slice(1).join(' ') || req.enrollee?.last_name || '',
              enrollee_id: displayEnrolleeId,
              plan: req.enrollee?.plan,
              bands: enrolleeBands
            },
            band_summary: {
              total_bands: enrolleeBands.length,
              bands: enrolleeBands,
              message: `Enrollee has access to providers under ${enrolleeBands.length} band(s): ${enrolleeBands.join(", ")}`
            },
            source_type: 'provider_request'
          }
        })
    }

    const mergedRows = [...approvalCodesFormatted, ...pendingRequestRows].sort(
      (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    const pagedRows = mergedRows.slice(skip, skip + limit)
    const total = mergedRows.length

    return NextResponse.json({
      success: true,
      approval_codes: pagedRows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching provider approval codes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch provider approval codes' },
      { status: 500 }
    )
  }
}
