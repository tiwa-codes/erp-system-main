import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { getAddServiceWindowMeta } from "@/lib/add-service-window"
import { Prisma } from "@prisma/client"

type RequestServiceRecord = Record<string, unknown>

const normalizeServiceName = (value?: string | null) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const getStringValue = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null

const getBooleanValue = (value: unknown): boolean => value === true
const buildFullName = (firstName?: string | null, lastName?: string | null) =>
  `${firstName || ""} ${lastName || ""}`.trim()

const isPrimaryAutoApprovedRequest = (services: any[], status: string, diagnosis?: string | null) => {
  if (status !== "APPROVED") return false
  if ((diagnosis || "").match(/Additional services for approval code:/i)) return false
  if (!services.length) return false

  return services.every((service) => {
    if (service?.is_primary === true) return true
    return Number(service?.service_type) === 1
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canViewRequests = await checkPermission(session.user.role as any, 'call-centre', 'view')
    if (!canViewRequests) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const requestId = params.id

    // Fetch the provider request with all related data
    const providerRequest = await prisma.providerRequest.findUnique({
      where: { id: requestId },
      include: {
        request_items: {
          select: {
            id: true,
            service_name: true,
            service_amount: true,
            quantity: true,
            tariff_price: true,
            category: true,
            is_ad_hoc: true,
            is_added_after_approval: true,
            created_at: true
          }
        },
        provider: {
          select: {
            id: true,
            facility_name: true,
            facility_type: true,
            status: true,
            selected_bands: true
          }
        },
        enrollee: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true,
            gender: true,
            marital_status: true,
            end_date: true,
            organization_id: true,
            plan_id: true,
            organization: {
              select: {
                id: true,
                name: true
              }
            },
            plan: {
              select: {
                id: true,
                name: true,
                plan_type: true,
                annual_limit: true
              }
            }
          }
        }
      }
    })

    if (!providerRequest) {
      return NextResponse.json({
        success: false,
        error: 'Request not found',
        message: `Provider request with ID ${requestId} was not found`
      }, { status: 404 })
    }

    // Parse services - prioritize request_items (new format) over services JSON (legacy)
    let servicesArray: RequestServiceRecord[] = []
    
    // First try: Use request_items if available (new structured format)
    if (providerRequest.request_items && Array.isArray(providerRequest.request_items) && providerRequest.request_items.length > 0) {
      servicesArray = providerRequest.request_items.map((item) => ({
        id: item.id,
        service_name: item.service_name,
        amount: Number(item.service_amount),
        quantity: Number(item.quantity) || 1,
        tariff_price: item.tariff_price ? Number(item.tariff_price) : null,
        category_id: item.category || null,
        service_category: item.category || null,
        is_ad_hoc: item.is_ad_hoc || false,
        is_added_after_approval: item.is_added_after_approval || false,
        is_primary: false,
        // Preserve coverage and rejection_reason from services JSON if available
        coverage: null, // Will be set below
        rejection_reason: null,
        remarks: null,
        provider_additional_comment: null
      }))
    } else {
      // Fallback: Parse services JSON string (legacy format)
      try {
        if (providerRequest.services) {
          servicesArray = JSON.parse(providerRequest.services)
        }
      } catch (error) {
        // If parsing fails, create a simple service object
        servicesArray = [{
          id: '1',
          service_name: providerRequest.services,
          amount: Number(providerRequest.amount) || 0,
          coverage: 'COVERED'
        }]
      }
    }

    // If we used request_items, merge coverage/rejection data from services JSON
    if (providerRequest.request_items && providerRequest.request_items.length > 0 && providerRequest.services) {
      try {
        const servicesJson = JSON.parse(providerRequest.services)
        if (Array.isArray(servicesJson)) {
          // Match request_items with services JSON - prioritize ID matching
          servicesArray = servicesArray.map((item, index: number) => {
            // Strategy 1: Match by request_item ID (most reliable)
            let jsonService = servicesJson.find((service: RequestServiceRecord) =>
              service.id === item.id ||
              service.service_id === item.id
            )
            
            // Strategy 2: Match by service_name if ID didn't match
            if (!jsonService && item.service_name) {
              const nameMatches = servicesJson.filter((service: RequestServiceRecord) =>
                service.service_name === item.service_name ||
                service.name === item.service_name
              )
              // If multiple matches, use the one at the same index
              if (nameMatches.length === 1) {
                jsonService = nameMatches[0]
              } else if (nameMatches.length > 1 && index < nameMatches.length) {
                jsonService = nameMatches[index]
              } else if (nameMatches.length > 0) {
                jsonService = nameMatches[0]
              }
            }
            
            // Strategy 3: Fallback to index only if arrays are same length
            if (!jsonService && servicesJson.length === servicesArray.length && index < servicesJson.length) {
              jsonService = servicesJson[index]
            }

            if (jsonService) {
              return {
                ...item,
                // CRITICAL: Preserve request_item ID as primary identifier (don't overwrite with JSON ID)
                id: item.id, // Keep request_item.id as the primary ID for matching
                coverage: jsonService.coverage || jsonService.coverage_status || item.coverage,
                rejection_reason: jsonService.rejection_reason || jsonService.remarks || item.rejection_reason,
                remarks: jsonService.remarks || jsonService.rejection_reason || item.remarks,
                provider_additional_comment:
                  jsonService.provider_additional_comment ||
                  jsonService.added_services_comment ||
                  jsonService.comment ||
                  item.provider_additional_comment ||
                  null,
                is_approved: jsonService.is_approved,
                is_added_after_approval: jsonService.is_added_after_approval || jsonService.is_added_later || item.is_added_after_approval || false,
                is_primary: jsonService.is_primary === true || item.is_primary === true,
                // Preserve other fields from JSON
                service_type: jsonService.service_type,
                service_type_id: jsonService.service_type_id,
                category_id:
                  jsonService.category_id ||
                  jsonService.category ||
                  item.category_id ||
                  null,
                service_category:
                  jsonService.service_category ||
                  jsonService.category_name ||
                  jsonService.category ||
                  item.service_category ||
                  null,
                // Also keep the JSON service ID as service_id for backward compatibility
                service_id: jsonService.id || jsonService.service_id || item.id,
                amount: Number(
                  jsonService.final_price ??
                  jsonService.service_amount ??
                  jsonService.amount ??
                  item.amount ??
                  0
                ),
                tariff_price:
                  jsonService.tariff_price ??
                  jsonService.service_amount ??
                  item.tariff_price ??
                  null,
                quantity: Number(jsonService.quantity ?? item.quantity ?? 1) || 1
              }
            }
            return item
          })
        }
      } catch (error) {
        console.error('Error merging services JSON with request_items:', error)
        // Continue with request_items data only
      }
    }

    // Get currently defined services to populate missing tariff prices (for historical data)
    const serviceLookupKeys = Array.from(
      new Set(
        servicesArray
          .flatMap((service) => [service.id, service.service_id, service.service_type_id])
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      )
    )
    const serviceNames: string[] = Array.from(
      new Set(
        servicesArray
          .map((service) => String(service.service_name || "").trim())
          .filter((value): value is string => value.length > 0)
      )
    )
    const serviceDefinitionClauses: Prisma.ServiceTypeWhereInput[] = [
      ...(serviceLookupKeys.length > 0
        ? [
            { id: { in: serviceLookupKeys } },
            { service_id: { in: serviceLookupKeys } }
          ]
        : []),
      ...serviceNames.map((serviceName) => ({
        service_name: {
          equals: serviceName,
          mode: Prisma.QueryMode.insensitive
        }
      }))
    ]
    const serviceDefinitions = await prisma.serviceType.findMany({
      where: serviceDefinitionClauses.length > 0 ? { OR: serviceDefinitionClauses } : undefined,
      select: {
        id: true,
        service_id: true,
        service_name: true,
        service_category: true,
        nhia_price: true
      }
    })

    const serviceDefMap = new Map<string, (typeof serviceDefinitions)[number]>()
    serviceDefinitions.forEach((serviceDefinition) => {
      serviceDefMap.set(serviceDefinition.id, serviceDefinition)
      serviceDefMap.set(serviceDefinition.service_id, serviceDefinition)
      const normalizedName = normalizeServiceName(serviceDefinition.service_name)
      if (normalizedName) {
        serviceDefMap.set(`name:${normalizedName}`, serviceDefinition)
      }
    })

    const resolvedServiceTypeIds = Array.from(
      new Set(
        servicesArray
          .map((service) => {
            const serviceId = getStringValue(service.id)
            const legacyServiceId = getStringValue(service.service_id)
            const serviceTypeId = getStringValue(service.service_type_id)
            const serviceName = getStringValue(service.service_name)
            const definition =
              (serviceId ? serviceDefMap.get(serviceId) : undefined) ||
              (legacyServiceId ? serviceDefMap.get(legacyServiceId) : undefined) ||
              (serviceTypeId ? serviceDefMap.get(serviceTypeId) : undefined) ||
              serviceDefMap.get(`name:${normalizeServiceName(serviceName)}`)

            return serviceTypeId || definition?.id || null
          })
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      )
    )

    // Fetch only the coverage rows relevant to this request instead of loading
    // the enrollee's entire plan coverage tree.
    const coveredServices =
      providerRequest.enrollee?.plan_id && providerRequest.provider_id && resolvedServiceTypeIds.length > 0
        ? await prisma.coveredService.findMany({
            where: {
              plan_id: providerRequest.enrollee.plan_id,
              facility_id: providerRequest.provider_id,
              status: "ACTIVE",
              service_type_id: { in: resolvedServiceTypeIds }
            },
            select: {
              service_type_id: true,
              facility_price: true,
              limit_count: true,
              status: true
            }
          })
        : []

    const coveredServiceTypeIds = new Set(coveredServices.map(cs => cs.service_type_id))

    // Enhance services with coverage information AND price verification
    const servicesWithCoverage = servicesArray.map((service) => {
      const serviceId = getStringValue(service.id)
      const legacyServiceId = getStringValue(service.service_id)
      const serviceTypeId = getStringValue(service.service_type_id)
      const serviceName = getStringValue(service.service_name)
      const def =
        (serviceId ? serviceDefMap.get(serviceId) : undefined) ||
        (legacyServiceId ? serviceDefMap.get(legacyServiceId) : undefined) ||
        (serviceTypeId ? serviceDefMap.get(serviceTypeId) : undefined) ||
        serviceDefMap.get(`name:${normalizeServiceName(serviceName)}`)
      const resolvedServiceTypeId = serviceTypeId || def?.id || legacyServiceId || serviceId

      // Auto-cover NHIA services as per requirement, or check plan
      const isNhia = providerRequest.tariff_type === 'NHIA'
      const normalizedServiceTypeId = resolvedServiceTypeId || ""
      const isCovered = isNhia || coveredServiceTypeIds.has(normalizedServiceTypeId)
      const coveredService = coveredServices.find(cs => cs.service_type_id === normalizedServiceTypeId)

      const storedCoverage =
        getStringValue(service.coverage) ||
        getStringValue(service.coverage_status)
      const effectiveCoverage = storedCoverage || (isCovered ? 'COVERED' : 'NOT_COVERED')

      // Backfill tariff_price if missing
      let tariffPrice = service.tariff_price
      if (tariffPrice === undefined && def) {
        tariffPrice = Number(def.nhia_price) || 0
      }

      // Determine if negotiable (Zero Price)
      const isNegotiable = getBooleanValue(service.is_negotiable) || tariffPrice === 0

      return {
        ...service,
        tariff_price: tariffPrice,
        is_negotiable: isNegotiable,
        is_added_after_approval:
          getBooleanValue(service.is_added_after_approval) ||
          getBooleanValue(service.is_added_later) ||
          false,
        is_primary: getBooleanValue(service.is_primary),
        provider_additional_comment:
          getStringValue(service.provider_additional_comment) ||
          getStringValue(service.added_services_comment) ||
          getStringValue(service.comment) ||
          null,
        is_covered: ['COVERED', 'EXCEEDED', 'LIMIT_EXCEEDED'].includes(effectiveCoverage),
        coverage_status: effectiveCoverage,
        coverage_limit: coveredService?.limit_count || null,
        coverage_bands: []
      }
    })

    // Get previous encounters for this enrollee (encounter codes)
    const previousEncounters = await prisma.approvalCode.findMany({
      where: {
        enrollee_id: providerRequest.enrollee_id,
        approval_code: {
          startsWith: 'ENC-'
        }
      },
      orderBy: { created_at: 'desc' },
      take: 10,
      include: {
        claim: {
          select: {
            id: true,
            status: true,
            amount: true
          }
        }
      }
    })

    // Get previous approval codes (non-encounter)
    const previousApprovalCodes = await prisma.approvalCode.findMany({
      where: {
        enrollee_id: providerRequest.enrollee_id,
        approval_code: {
          startsWith: 'APR'
        }
      },
      orderBy: { created_at: 'desc' },
      take: 10
    })

    const diagnosisText = providerRequest.diagnosis || ""
    const originalApprovalCodeMatch = diagnosisText.match(/Additional services for approval code:\s*([A-Za-z0-9\/-]+)/i)
    let originalApprovalCode = originalApprovalCodeMatch?.[1] || null
    const cleanedDiagnosis = diagnosisText
      .replace(/Additional services for approval code:\s*[A-Z0-9\/-]+\s*\.?\s*/i, "")
      .trim()
    const hasAddedAfterApprovalServices =
      servicesWithCoverage.some((service: any) => service.is_added_after_approval === true) ||
      providerRequest.request_items.some((item: any) => item.is_added_after_approval === true)

    let originalCodeRecord: any = null
    if (originalApprovalCode) {
      originalCodeRecord = await prisma.approvalCode.findFirst({
        where: {
          approval_code: originalApprovalCode,
          is_deleted: false
        },
        include: {
          service_items: {
            orderBy: { added_at: "asc" }
          }
        }
      })
    }

    // Fallback resolution when diagnosis marker is missing
    if (!originalCodeRecord && hasAddedAfterApprovalServices) {
      if (providerRequest.claim_id) {
        originalCodeRecord = await prisma.approvalCode.findFirst({
          where: {
            claim_id: providerRequest.claim_id,
            enrollee_id: providerRequest.enrollee_id,
            is_deleted: false
          },
          include: { service_items: { orderBy: { added_at: "asc" } } },
          orderBy: { created_at: "desc" }
        })
      }
      if (!originalCodeRecord) {
        originalCodeRecord = await prisma.approvalCode.findFirst({
          where: {
            enrollee_id: providerRequest.enrollee_id,
            provider_id: providerRequest.provider_id,
            hospital: providerRequest.hospital,
            status: { in: ["APPROVED", "PARTIAL"] },
            is_deleted: false,
            created_at: { lte: providerRequest.created_at }
          },
          include: { service_items: { orderBy: { added_at: "asc" } } },
          orderBy: { created_at: "desc" }
        })
      }
      if (!originalCodeRecord) {
        originalCodeRecord = await prisma.approvalCode.findFirst({
          where: {
            enrollee_id: providerRequest.enrollee_id,
            hospital: providerRequest.hospital,
            status: { in: ["APPROVED", "PARTIAL"] },
            is_deleted: false,
            created_at: { lte: providerRequest.created_at }
          },
          include: { service_items: { orderBy: { added_at: "asc" } } },
          orderBy: { created_at: "desc" }
        })
      }
      if (originalCodeRecord?.approval_code) {
        originalApprovalCode = originalCodeRecord.approval_code
      }
    }

    let originalApprovalServices: any[] = []
    if (originalCodeRecord) {
      try {
        const parsed = JSON.parse(originalCodeRecord.services || "[]")
        if (Array.isArray(parsed) && parsed.length > 0) {
          originalApprovalServices = parsed.map((item: any, index: number) => ({
            id: item.id || item.service_id || `existing-${index}`,
            service_name: item.service_name || item.name || "Service",
            amount: Number(item.amount ?? item.service_amount ?? 0),
            quantity: Number(item.quantity) || 1,
            is_ad_hoc: item.is_ad_hoc === true,
            coverage: item.coverage || item.coverage_status || null,
            rejection_reason: item.rejection_reason || item.remarks || null
          }))
        }
      } catch {
        originalApprovalServices = []
      }

      if (originalApprovalServices.length === 0 && originalCodeRecord.service_items.length > 0) {
        originalApprovalServices = originalCodeRecord.service_items.map((item: any) => ({
          id: item.id,
          service_name: item.service_name,
          amount: Number(item.service_amount),
          quantity: Number(item.quantity) || 1,
          is_ad_hoc: item.is_ad_hoc || false,
          coverage: "COVERED",
          rejection_reason: null
        }))
      }
    }

    const isAddedAfterApprovalRequest = hasAddedAfterApprovalServices || !!originalApprovalCode
    const originalApprovalTimeline = originalCodeRecord
      ? await prisma.approvalCodeTimeline.findFirst({
        where: {
          approval_code_id: originalCodeRecord.id,
          stage: "APPROVED"
        },
        orderBy: { timestamp: "asc" },
        select: { timestamp: true }
      })
      : null
    const addServiceWindow = originalCodeRecord
      ? getAddServiceWindowMeta({
        createdAt: originalCodeRecord.created_at,
        approvedAt: originalApprovalTimeline?.timestamp || null
      })
      : null
    const addedServicesComment = [...servicesWithCoverage].reverse().find(
      (service: any) =>
        typeof service.provider_additional_comment === "string" &&
        service.provider_additional_comment.trim().length > 0
    )?.provider_additional_comment || null
    const computedTotalAmount = servicesWithCoverage.reduce((sum: number, service: any) => {
      const amount = Number(
        service.amount ??
        service.final_price ??
        service.service_amount ??
        0
      )
      const quantity = Number(service.quantity) || 1
      return sum + (amount * quantity)
    }, 0)
    const liveDependent = providerRequest.beneficiary_id && providerRequest.beneficiary_id !== providerRequest.enrollee?.enrollee_id
      ? await prisma.dependent.findFirst({
          where: {
            dependent_id: providerRequest.beneficiary_id
          },
          select: {
            first_name: true,
            last_name: true
          }
        })
      : null
    const liveDependentName = liveDependent
      ? buildFullName(liveDependent.first_name, liveDependent.last_name)
      : null
    const livePrincipalName = buildFullName(providerRequest.enrollee?.first_name, providerRequest.enrollee?.last_name)
    const displayEnrolleeName =
      liveDependentName ||
      providerRequest.beneficiary_name ||
      livePrincipalName

    // Format the response to match the expected structure
    const formattedRequest = {
      id: providerRequest.id,
      request_id: providerRequest.request_id || `REQ-${providerRequest.id.slice(-8).toUpperCase()}`,
      provider_id: providerRequest.provider_id,
      tariff_type: providerRequest.tariff_type || "PRIVATE",
      enrollee_id: providerRequest.beneficiary_id || providerRequest.enrollee?.enrollee_id || '',
      enrollee_name: displayEnrolleeName,
      beneficiary_id: providerRequest.beneficiary_id || null,
      beneficiary_name: liveDependentName || providerRequest.beneficiary_name || null,
      is_dependent: !!providerRequest.beneficiary_id && providerRequest.beneficiary_id !== providerRequest.enrollee?.enrollee_id,
      organization: providerRequest.enrollee?.organization?.name || '',
      plan: providerRequest.enrollee?.plan?.name || '',
      enrollee_organization_name: providerRequest.enrollee?.organization?.name || '',
      enrollee_plan_name: providerRequest.enrollee?.plan?.name || '',
      enrollee_gender: providerRequest.enrollee?.gender || null,
      enrollee_marital_status: providerRequest.enrollee?.marital_status || null,
      enrollee_expiration_date: providerRequest.enrollee?.end_date || null,
      plan_annual_limit: providerRequest.enrollee?.plan?.annual_limit || 0,
      diagnosis: cleanedDiagnosis,
      provider_name: providerRequest.provider?.facility_name || '',
      hospital_name: providerRequest.provider?.facility_name || '',
      provider_bands: Array.isArray(providerRequest.provider?.selected_bands)
        ? providerRequest.provider.selected_bands
        : [],
      services: servicesWithCoverage,
      added_services_comment: addedServicesComment,
      original_approval_code: originalApprovalCode,
      is_added_after_approval_request: isAddedAfterApprovalRequest,
      is_primary_auto_approved: isPrimaryAutoApprovedRequest(
        servicesWithCoverage,
        providerRequest.status,
        providerRequest.diagnosis
      ),
      add_service_window_started_at: addServiceWindow?.windowStartedAt?.toISOString() || null,
      add_service_expires_at: addServiceWindow?.expiresAt?.toISOString() || null,
      add_service_seconds_remaining: addServiceWindow?.remainingSeconds ?? 0,
      add_service_window_expired: addServiceWindow?.isExpired ?? true,
      original_approval_services: originalApprovalServices,
      total_amount: computedTotalAmount > 0 ? computedTotalAmount : (Number(providerRequest.amount) || 0),
      status: providerRequest.status,
      date: providerRequest.created_at,
      admission_required: providerRequest.admission_required || false,
      previous_encounters: previousEncounters.map(enc => ({
        id: enc.id,
        encounter_code: enc.approval_code,
        diagnosis: enc.diagnosis,
        hospital: enc.hospital,
        amount: enc.amount,
        date: enc.created_at,
        claim_status: enc.claim?.status
      })),
      previous_approval_codes: previousApprovalCodes.map(code => ({
        id: code.id,
        approval_code: code.approval_code,
        hospital: code.hospital,
        amount: code.amount,
        date: code.created_at,
        status: code.status
      }))
    }

    return NextResponse.json({
      success: true,
      request: formattedRequest
    })
  } catch (error) {
    console.error('Error fetching provider request:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch provider request',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}
