import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { generateDailyApprovalCode } from "@/lib/approval-code"
import { getAddServiceWindowMeta } from "@/lib/add-service-window"

function parseServicesPayload(raw: string | null | undefined): any[] {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function normalizeServiceLabel(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function isPrimaryAutoApprovedRequest(services: any[], status: string, diagnosis?: string | null) {
  if (status !== "APPROVED") return false
  if ((diagnosis || "").match(/Additional services for approval code:/i)) return false
  if (!services.length) return false

  return services.every((service) => {
    if (service?.is_primary === true) return true
    return Number(service?.service_type) === 1
  })
}

function parseRejectedByName(rawReason: string | null | undefined): string | null {
  if (!rawReason) return null

  try {
    const parsed = JSON.parse(rawReason)

    if (typeof parsed?.rejected_by_name === "string" && parsed.rejected_by_name.trim()) {
      return parsed.rejected_by_name.trim()
    }

    if (Array.isArray(parsed?.rejected_services) && parsed.rejected_services.length > 0) {
      const firstNamed = parsed.rejected_services.find((service: any) =>
        typeof service?.rejected_by_name === "string" && service.rejected_by_name.trim()
      )
      if (firstNamed?.rejected_by_name) {
        return String(firstNamed.rejected_by_name).trim()
      }
    }
  } catch {
    return null
  }

  return null
}

const buildFullName = (firstName?: string | null, lastName?: string | null) =>
  `${firstName || ""} ${lastName || ""}`.trim()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has call-centre permissions
    const hasPermission = await checkPermission(session.user.role as any, "call-centre", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const rawStatus = (searchParams.get("status") || "ALL").toUpperCase()
    const allowedStatuses = ["PENDING", "APPROVED", "PARTIAL", "REJECTED"] as const
    const selectedStatus = allowedStatuses.includes(rawStatus as any) ? rawStatus : "ALL"

    const skip = (page - 1) * limit

    // Build where clause - show all requests including pending ones that need processing
    const where: any = {
      status: selectedStatus === "ALL"
        ? { in: [...allowedStatuses] }
        : selectedStatus
    }

    const trimmedSearch = search.trim()
    if (trimmedSearch) {
      const words = trimmedSearch.split(/\s+/)

      // enrollee_id is a structured ID like "CJH/001/854" - use contains so partial matches work
      const enrolleeConditions = words.map(term => ({
        OR: [
          { enrollee_id: { contains: term, mode: "insensitive" } }, // ID: substring match
          { first_name: { startsWith: term, mode: "insensitive" } },
          { last_name: { startsWith: term, mode: "insensitive" } }
        ]
      }))

      where.OR = [
        { provider: { facility_name: { startsWith: trimmedSearch, mode: "insensitive" } } },
        { hospital: { startsWith: trimmedSearch, mode: "insensitive" } },
        // beneficiary_id: contains for partial ID match (e.g. "854" finds "CJH/001/854")
        { beneficiary_id: { contains: trimmedSearch, mode: "insensitive" } },
        { beneficiary_name: { startsWith: trimmedSearch, mode: "insensitive" } },
        {
          enrollee: {
            AND: enrolleeConditions
          }
        },
      ]
    }

    const [providerRequests, total] = await Promise.all([
      prisma.providerRequest.findMany({
        where,
        skip,
        take: limit,
        // Use latest activity ordering so updated/reopened pending requests surface to the top.
        orderBy: [{ updated_at: "desc" }, { created_at: "desc" }],
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
                  name: true
                }
              }
            }
          }
        }
      }),
      prisma.providerRequest.count({ where })
    ])

    // Get approval codes for approved and partial requests
    const approvedAndPartialRequestIds = providerRequests
      .filter(req => req.status === 'APPROVED' || req.status === 'PARTIAL' || req.status === 'REJECTED')
      .map(req => req.id)

    const approvalCodes = approvedAndPartialRequestIds.length > 0
      ? await prisma.approvalCode.findMany({
        where: {
          enrollee_id: { in: providerRequests.map(req => req.enrollee_id) },
          hospital: { in: providerRequests.map(req => req.hospital) },
          is_deleted: false
        },
        select: {
          id: true,
          approval_code: true,
          enrollee_id: true,
          amount: true,
          hospital: true,
          provider_id: true,
          claim_id: true,
          services: true,
          created_at: true,
          generated_by: {
            select: {
              first_name: true,
              last_name: true
            }
          }
        }
      })
      : []

    const approvalTimelineRows = approvalCodes.length > 0
      ? await prisma.approvalCodeTimeline.findMany({
        where: {
          approval_code_id: { in: approvalCodes.map(code => code.id) },
          stage: "APPROVED"
        },
        orderBy: { timestamp: "asc" },
        select: {
          approval_code_id: true,
          timestamp: true,
          user: {
            select: {
              first_name: true,
              last_name: true
            }
          }
        }
      })
      : []

    const approvedAtByCodeId = new Map<string, Date>()
    const approverNameByCodeId = new Map<string, string>()
    for (const timeline of approvalTimelineRows) {
      if (!approvedAtByCodeId.has(timeline.approval_code_id)) {
        approvedAtByCodeId.set(timeline.approval_code_id, timeline.timestamp)
      }
      const approverName = `${timeline.user?.first_name || ""} ${timeline.user?.last_name || ""}`.trim()
      if (approverName) {
        approverNameByCodeId.set(timeline.approval_code_id, approverName)
      }
    }

    const dependentIdsToResolve = Array.from(
      new Set(
        providerRequests
          .filter((request) =>
            typeof request.beneficiary_id === "string" &&
            request.beneficiary_id.trim().length > 0 &&
            request.beneficiary_id !== request.enrollee?.enrollee_id
          )
          .map((request) => request.beneficiary_id as string)
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

    // Format provider requests
    const formattedRequests = providerRequests.map(request => {
      const requestServices = parseServicesPayload(request.services)
      const requestServiceLabels = requestServices
        .map(service =>
          normalizeServiceLabel(
            service.service_name ||
            service.name ||
            service.service_id ||
            service.id
          )
        )
        .filter(Boolean)

      const diagnosisReferencedCode = request.diagnosis
        ? (request.diagnosis.match(/Additional services for approval code:\s*([A-Z0-9\/-]+)/i)?.[1] || null)
        : null

      // Find matching approval code.
      // Rules:
      // 1) Rejected requests should never display/generated an approval code.
      // 2) If diagnosis references an original approval code, use that exact code.
      // 3) Otherwise use claim-linked approval code.
      // NOTE: No broad fallback by enrollee/hospital to avoid showing one code on unrelated requests.
      let matchingApprovalCode = null
      if (request.status === 'APPROVED' || request.status === 'PARTIAL') {
        if (diagnosisReferencedCode) {
          matchingApprovalCode = approvalCodes.find(code => code.approval_code === diagnosisReferencedCode) || null
        }

        if (!matchingApprovalCode && request.claim_id) {
          matchingApprovalCode = approvalCodes.find(code =>
            code.claim_id === request.claim_id &&
            code.enrollee_id === request.enrollee_id
          ) || null
        }

        if (!matchingApprovalCode && requestServiceLabels.length > 0) {
          const candidateCodes = approvalCodes
            .filter(code =>
              code.enrollee_id === request.enrollee_id &&
              code.hospital === request.hospital &&
              code.provider_id === request.provider_id &&
              code.created_at <= request.updated_at
            )
            .map(code => {
              const codeServices = parseServicesPayload(code.services)
              const codeServiceLabels = codeServices
                .map(service =>
                  normalizeServiceLabel(
                    service.service_name ||
                    service.name ||
                    service.service_id ||
                    service.id
                  )
                )
                .filter(Boolean)

              const overlapCount = requestServiceLabels.filter(label =>
                codeServiceLabels.includes(label)
              ).length

              return {
                code,
                overlapCount,
                createdAt: code.created_at.getTime()
              }
            })
            .filter(candidate => candidate.overlapCount > 0)
            .sort((a, b) => {
              if (b.overlapCount !== a.overlapCount) {
                return b.overlapCount - a.overlapCount
              }

              return b.createdAt - a.createdAt
            })

          matchingApprovalCode = candidateCodes[0]?.code || null
        }

      }

      const enrolleeDisplayName = buildFullName(request.enrollee?.first_name, request.enrollee?.last_name)
      const liveDependentName = request.beneficiary_id
        ? dependentNameById.get(request.beneficiary_id) || null
        : null
      const beneficiaryName = liveDependentName || request.beneficiary_name || enrolleeDisplayName
      const beneficiaryId = request.beneficiary_id || request.enrollee?.enrollee_id || ''
      const isDependent = !!request.beneficiary_id && request.beneficiary_id !== request.enrollee?.enrollee_id
      const addServiceWindow = matchingApprovalCode
        ? getAddServiceWindowMeta({
          createdAt: matchingApprovalCode.created_at,
          approvedAt: approvedAtByCodeId.get(matchingApprovalCode.id) || null
        })
        : null
      const isAddedAfterApprovalRequest = !!diagnosisReferencedCode
      const isPrimaryAutoApproved = isPrimaryAutoApprovedRequest(
        requestServices,
        request.status,
        request.diagnosis
      )
      const rejectedByName = parseRejectedByName(request.rejection_reason)
      const approvedByName = matchingApprovalCode
        ? approverNameByCodeId.get(matchingApprovalCode.id) ||
          (`${matchingApprovalCode.generated_by?.first_name || ''} ${matchingApprovalCode.generated_by?.last_name || ''}`.trim() || null)
        : null

      const displayServices = matchingApprovalCode ? matchingApprovalCode.services : request.services
      const displayAmount = matchingApprovalCode ? Number(matchingApprovalCode.amount || 0) : Number(request.amount || 0)

      return {
        id: request.id,
        request_id: `REQ-${request.id.slice(-8).toUpperCase()}`,
        enrollee_name: beneficiaryName,
        enrollee_id: beneficiaryId,
        beneficiary_id: request.beneficiary_id,
        beneficiary_name: request.beneficiary_name,
        is_dependent: isDependent,
        provider_name: request.provider.facility_name,
        hospital_name: request.hospital,
        plan: request.enrollee?.plan?.name || '',
        approved_by: request.status === 'REJECTED' ? (rejectedByName || null) : approvedByName,
        rejected_by: rejectedByName,
        services: displayServices,
        amount: displayAmount,
        status: request.status,
        date: request.created_at,
        approval_code: request.status === 'REJECTED' ? 'Rejected' : (matchingApprovalCode?.approval_code || null),
        is_added_after_approval_request: isAddedAfterApprovalRequest,
        is_primary_auto_approved: isPrimaryAutoApproved,
        add_service_window_started_at: addServiceWindow?.windowStartedAt?.toISOString() || null,
        add_service_expires_at: addServiceWindow?.expiresAt?.toISOString() || null,
        add_service_seconds_remaining: addServiceWindow?.remainingSeconds ?? 0,
        add_service_window_expired: addServiceWindow?.isExpired ?? true,
        provider: request.provider,
        enrollee: request.enrollee
      }
    })

    return NextResponse.json({
      success: true,
      provider_requests: formattedRequests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error("Error fetching provider requests:", error)
    return NextResponse.json(
      { error: "Failed to fetch provider requests" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has call-centre permissions OR providers module permission
    // Providers should be able to submit requests too
    const hasCallCentrePermission = await checkPermission(session.user.role as any, "call-centre", "add")
    const hasProviderPermission = await checkPermission(session.user.role as any, "providers", "add")

    if (!hasCallCentrePermission && !hasProviderPermission) {
      return NextResponse.json({
        error: "Insufficient permissions. You need either call-centre or providers add permission.",
        debug: {
          role: session.user.role,
          hasCallCentre: hasCallCentrePermission,
          hasProvider: hasProviderPermission
        }
      }, { status: 403 })
    }

    const body = await request.json()
    const {
      provider_id,
      enrollee_id,
      hospital,
      services,
      amount,
      diagnosis,
      tariff_type
    } = body

    if (!provider_id || !enrollee_id || !hospital || !services) {
      return NextResponse.json({ error: "Provider ID, enrollee ID, hospital, and services are required" }, { status: 400 })
    }

    // Process services to include price information for negotiable services
    const processedServices = services.map((s: any) => ({
      ...s,
      tariff_price: s.tariff_price || s.amount, // Original price from tariff
      negotiated_price: s.negotiated_price || s.amount, // Provider's proposed price (for zero-price services)
      is_negotiable: s.is_negotiable || s.amount === 0, // Flag for call center
      // Use tariff_price (unit price) as the canonical price — s.amount may be qty*unit when qty>1
      final_price: s.negotiated_price || s.tariff_price || s.amount // Price to use for calculations
    }))

    // Split services into Primary (service_type = 1) and Secondary (service_type = null)
    const primaryServices = processedServices.filter((s: any) => s.service_type === 1)
    const secondaryServices = processedServices.filter((s: any) => s.service_type !== 1)

    let approvalCode = null
    let providerRequest = null

    // Check for Enrollee (Principal) or Dependent
    let principalId = enrollee_id
    let beneficiaryId = null
    let beneficiaryName = ""
    let enrolleeStringId = ""

    // 1. Try finding Principal by id (UUID) or enrollee_id (string)
    let enrollee = await prisma.principalAccount.findFirst({
      where: {
        OR: [
          { id: enrollee_id },
          { enrollee_id: enrollee_id }
        ]
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        enrollee_id: true
      }
    })

    if (enrollee) {
      principalId = enrollee.id
      beneficiaryId = enrollee.enrollee_id // For principal, beneficiary ID matches enrollee ID logic usually
      beneficiaryName = `${enrollee.first_name} ${enrollee.last_name}`
      enrolleeStringId = enrollee.enrollee_id
    } else {
      // 2. Try finding Dependent by id (UUID) or dependent_id (string)
      const dependent = await prisma.dependent.findFirst({
        where: {
          OR: [
            { id: enrollee_id },
            { dependent_id: enrollee_id }
          ]
        },
        include: {
          principal: true
        }
      })

      if (dependent && dependent.principal) {
        enrollee = dependent.principal // Set enrollee object to principal for downstream usage
        principalId = dependent.principal_id
        beneficiaryId = dependent.dependent_id
        beneficiaryName = `${dependent.first_name} ${dependent.last_name}`
        enrolleeStringId = dependent.dependent_id
      }
    }

    // If still not found, return 404
    if (!enrollee) {
      return NextResponse.json({ error: "Enrollee not found (checked Principal and Dependent)" }, { status: 404 })
    }

    // Generate approval code for primary services
    let createdClaimId: string | null = null
    if (primaryServices.length > 0) {
      const primaryAmount = primaryServices.reduce((sum: number, s: any) => {
        const price = parseFloat(s.final_price) || 0
        const quantity = Number(s.quantity) || 1
        return sum + (price * quantity)
      }, 0)
      const generatedCode = await generateDailyApprovalCode(prisma)

      console.log('📝 Creating approval code for PRIMARY services:', {
        approval_code: generatedCode,
        enrollee_id: principalId,
        beneficiary_id: beneficiaryId,
        enrollee_name: beneficiaryName,
        hospital,
        amount: primaryAmount
      })

      // Tag each primary service with coverage + is_primary so that the provider
      // approval-code detail view can correctly classify them as approved initial services.
      const primaryServicesForStorage = primaryServices.map((s: any) => ({
        ...s,
        is_primary: true,
        coverage: 'COVERED',
        is_approved: true
      }))

      approvalCode = await prisma.approvalCode.create({
        data: {
          approval_code: generatedCode,
          enrollee_id: principalId, // MUST be Principal ID for FK
          beneficiary_id: beneficiaryId, // String ID of the actual patient
          enrollee_name: beneficiaryName, // Name of the actual patient
          hospital,
          provider_id: provider_id,
          services: JSON.stringify(primaryServicesForStorage),
          amount: primaryAmount,
          diagnosis: diagnosis || '',
          status: 'APPROVED',
          generated_by_id: session.user.id,
          // Create structured service items
          service_items: {
            create: primaryServices.map((s: any) => ({
              service_name: s.service_name || s.name,
              service_amount: Number(s.final_price),
              quantity: Number(s.quantity) || 1,
              is_initial: true,
              is_ad_hoc: !!s.is_ad_hoc,
              tariff_price: s.tariff_price || null,
              service_id: s.id,
              category: s.category_id || s.service_category || null
            }))
          }
        }
      })

      console.log('✅ Primary services approval code created:', approvalCode.approval_code)

      // Create audit log for approval code
      await prisma.auditLog.create({
        data: {
          user_id: session.user.id,
          action: "APPROVE",
          resource: "approval_code",
          resource_id: approvalCode.id,
          new_values: {
            ...approvalCode,
            reason: "Auto-approved: All Primary services"
          }
        }
      })

      // 🚀 AUTOMATIC CLAIM CREATION FOR PRIMARY SERVICES
      try {
        console.log('📝 Creating claim for primary services...')

        // Generate unique claim number
        const claimNumber = `CLM-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`

        // Create claim with NEW status
        const newClaim = await prisma.claim.create({
          data: {
            claim_number: claimNumber,
            enrollee_id: enrolleeStringId, // Use the actual patient's string ID
            principal_id: principalId,     // Link to Principal
            provider_id: provider_id,
            claim_type: 'MEDICAL',
            amount: primaryAmount,
            original_amount: primaryAmount,
            status: 'NEW',
            current_stage: null,
            submitted_at: new Date(),
            created_by_id: session.user.id,
          }
        })

        console.log('✅ Claim created for primary services:', newClaim.id, newClaim.claim_number)
        createdClaimId = newClaim.id

        // Link the approval code to the claim
        await prisma.approvalCode.update({
          where: { id: approvalCode.id },
          data: {
            claim_id: newClaim.id
          }
        })

        console.log('✅ Approval code linked to claim')
      } catch (error) {
        console.error('❌ Failed to create claim for primary services:', error)
        // Log but don't fail the request
      }

      if (secondaryServices.length === 0) {
        providerRequest = await prisma.providerRequest.create({
          data: {
            provider_id,
            enrollee_id: principalId,
            hospital,
            services: JSON.stringify(primaryServicesForStorage),
            amount: primaryAmount,
            diagnosis: diagnosis || null,
            status: 'APPROVED',
            tariff_type: tariff_type || 'PRIVATE',
            claim_id: createdClaimId,
            beneficiary_id: beneficiaryId,
            beneficiary_name: beneficiaryName,
            request_items: {
              create: primaryServices.map((s: any) => ({
                service_name: s.service_name || s.name,
                service_amount: Number(s.final_price),
                quantity: Number(s.quantity) || 1,
                tariff_price: s.tariff_price || null,
                is_ad_hoc: !!s.is_ad_hoc,
                category: s.category_id || s.service_category || null
              }))
            }
          },
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
                last_name: true
              }
            }
          }
        })

        await prisma.auditLog.create({
          data: {
            user_id: session.user.id,
            action: "PROVIDER_REQUEST_CREATE",
            resource: "provider_request",
            resource_id: providerRequest.id,
            new_values: {
              ...providerRequest,
              note: "Primary-only request auto-approved and made visible to Call Centre"
            }
          }
        })
      }
    }

    // Handle Secondary Services - Send to Call Centre for manual approval
    // For mixed primary+secondary requests, create ONE pending provider request
    // that contains both service groups to keep a single request thread.
    if (secondaryServices.length > 0) {
      const allServicesForRequest = processedServices.map((s: any) => ({
        ...s,
        is_primary: s.service_type === 1,
        coverage: s.service_type === 1 ? 'COVERED' : null,
        is_approved: s.service_type === 1 ? true : undefined
      }))

      const requestAmount = allServicesForRequest.reduce((sum: number, s: any) => {
        const price = parseFloat(s.final_price) || 0
        const quantity = Number(s.quantity) || 1
        return sum + (price * quantity)
      }, 0)

    providerRequest = await prisma.providerRequest.create({
      data: {
        provider_id,
        enrollee_id: principalId, // MUST be Principal ID
        hospital,
        services: JSON.stringify(allServicesForRequest),
        amount: requestAmount,
        diagnosis: diagnosis || null,
        status: 'PENDING',
        tariff_type: tariff_type || 'PRIVATE',
        claim_id: createdClaimId,
        beneficiary_id: beneficiaryId,    // Actual patient ID (dependent or principal)
        beneficiary_name: beneficiaryName, // Actual patient name
        // Create structured request items
          request_items: {
            create: allServicesForRequest.map((s: any) => ({
              service_name: s.service_name || s.name,
              service_amount: Number(s.final_price),
              quantity: Number(s.quantity) || 1,
              tariff_price: s.tariff_price || null,
              is_ad_hoc: !!s.is_ad_hoc,
              category: s.category_id || s.service_category || null
            }))
          }
        },
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
              last_name: true
            }
          }
        }
      })

      // Create audit log for provider request
      await prisma.auditLog.create({
        data: {
          user_id: session.user.id,
          action: "PROVIDER_REQUEST_CREATE",
          resource: "provider_request",
          resource_id: providerRequest.id,
          new_values: {
            ...providerRequest,
            note: primaryServices.length > 0
              ? "Mixed request: primary services auto-approved; request is pending for secondary/manual review"
              : "Secondary services sent to Call Centre for manual approval"
          }
        }
      })
    }

    // Build response
    const response: any = {
      success: true,
      message: "",
      primary_services_count: primaryServices.length,
      secondary_services_count: secondaryServices.length
    }

    if (approvalCode && providerRequest && secondaryServices.length > 0) {
      // Mixed: Both Primary and Secondary services
      response.message = `Request processed: ${primaryServices.length} primary service(s) auto-approved, ${secondaryServices.length} secondary service(s) pending in the same request`
      response.approval_code = {
        code: approvalCode.approval_code,
        amount: approvalCode.amount,
        services: primaryServices
      }
      response.provider_request = {
        id: providerRequest.id,
        request_id: `REQ-${providerRequest.id.slice(-8).toUpperCase()}`,
        amount: providerRequest.amount,
        services: processedServices
      }
    } else if (approvalCode) {
      // All Primary services
      response.message = `All ${primaryServices.length} primary service(s) auto-approved`
      response.approval_code = {
        code: approvalCode.approval_code,
        amount: approvalCode.amount,
        services: primaryServices
      }
      if (providerRequest) {
        response.provider_request = {
          id: providerRequest.id,
          request_id: `REQ-${providerRequest.id.slice(-8).toUpperCase()}`,
          amount: providerRequest.amount,
          services: primaryServices,
          status: providerRequest.status,
          is_primary_auto_approved: true
        }
      }
    } else if (providerRequest) {
      // All Secondary services
      response.message = `All ${secondaryServices.length} secondary service(s) sent to Call Centre for approval`
      response.provider_request = {
        id: providerRequest.id,
        request_id: `REQ-${providerRequest.id.slice(-8).toUpperCase()}`,
        amount: providerRequest.amount,
        services: secondaryServices
      }
    }

    return NextResponse.json(response, { status: 201 })

  } catch (error) {
    console.error("Error creating provider request:", error)
    return NextResponse.json(
      { error: "Failed to create provider request" },
      { status: 500 }
    )
  }
}
