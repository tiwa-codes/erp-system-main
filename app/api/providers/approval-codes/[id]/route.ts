import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getAddServiceWindowMeta } from "@/lib/add-service-window"

const parseServices = (raw: string | null | undefined) => {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const buildFullName = (firstName?: string | null, lastName?: string | null) =>
  `${firstName || ""} ${lastName || ""}`.trim()

const isApprovedService = (service: any) => {
  const coverage = String(service?.coverage || service?.coverage_status || "").toUpperCase()
  if (coverage === "COVERED" || coverage === "EXCEEDED" || coverage === "LIMIT_EXCEEDED") {
    return true
  }

  // Legacy primary rows can be saved without explicit coverage but are still approved.
  const isPrimary = service?.is_primary === true || Number(service?.service_type) === 1
  if (isPrimary && !isRejectedService(service)) {
    return true
  }

  return false
}

const isRejectedService = (service: any) => {
  const coverage = String(service?.coverage || service?.coverage_status || "").toUpperCase()
  return (
    coverage === "REJECTED" ||
    coverage === "NOT_COVERED" ||
    coverage === "NOT_IN_PLAN" ||
    coverage === "NOT_ASSIGNED" ||
    coverage === "NOT_IN_BAND"
  )
}

const mapDisplayService = (service: any, index: number) => ({
  id: service.id || service.service_id || `service-${index}`,
  service_name: service.service_name || service.name || "Service",
  service_amount: Number(service.final_price ?? service.amount ?? service.service_amount ?? 0),
  quantity: Number(service.quantity) || 1,
  line_total: Number(service.final_price ?? service.amount ?? service.service_amount ?? 0) * (Number(service.quantity) || 1),
  added_at: service.added_at || service.created_at || null,
  rejection_reason: service.rejection_reason || service.remarks || null,
  coverage: service.coverage || service.coverage_status || null,
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params

    // Find the approval code with all related data
    const approvalCode = await prisma.approvalCode.findUnique({
      where: { id },
      include: {
        service_items: {
          include: {
            added_by: {
              select: {
                id: true,
                first_name: true,
                last_name: true
              }
            }
          },
          orderBy: { added_at: 'asc' }
        },
        enrollee: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        },
        generated_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true
          }
        }
      }
    })

    if (!approvalCode) {
      return NextResponse.json({ error: "Approval code does not exist" }, { status: 404 })
    }

    // Block access to soft-deleted codes
    if (approvalCode.is_deleted) {
      return NextResponse.json({ error: "Approval code does not exist" }, { status: 404 })
    }

    const providerRecord = approvalCode.provider_id
      ? null
      : await prisma.provider.findFirst({
        where: { facility_name: approvalCode.hospital },
        select: { id: true }
      })
    const providerId = approvalCode.provider_id || providerRecord?.id || null
    const liveDependent = (approvalCode as any).beneficiary_id
      ? await prisma.dependent.findFirst({
          where: {
            dependent_id: (approvalCode as any).beneficiary_id
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
    const livePrincipalName = buildFullName(approvalCode.enrollee?.first_name, approvalCode.enrollee?.last_name)
    const displayEnrolleeName = liveDependentName || livePrincipalName || approvalCode.enrollee_name
    const approvedTimeline = await prisma.approvalCodeTimeline.findFirst({
      where: {
        approval_code_id: approvalCode.id,
        stage: "APPROVED"
      },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true }
    })
    const addServiceWindow = getAddServiceWindowMeta({
      createdAt: approvalCode.created_at,
      approvedAt: approvedTimeline?.timestamp || null
    })

    // Fetch only truly-linked pending requests.
    // Avoid broad provider/hospital matching that can pull unrelated pending requests.
    const pendingRequestOrFilters: any[] = [
      { diagnosis: { contains: approvalCode.approval_code, mode: "insensitive" } }
    ]
    if (approvalCode.claim_id) {
      pendingRequestOrFilters.push({ claim_id: approvalCode.claim_id })
    }

    const linkedPendingRequest = await prisma.providerRequest.findFirst({
      where: {
        status: "PENDING",
        enrollee_id: approvalCode.enrollee_id,
        OR: pendingRequestOrFilters
      },
      include: {
        request_items: {
          orderBy: { created_at: "asc" }
        }
      },
      orderBy: { created_at: "desc" }
    })

    let pendingServices: any[] = []
    if (linkedPendingRequest) {
      const requestItemServices = linkedPendingRequest.request_items.map((item) => ({
        id: item.id,
        service_name: item.service_name,
        service_amount: Number(item.service_amount),
        quantity: Number(item.quantity) || 1,
        line_total: Number(item.service_amount) * (Number(item.quantity) || 1),
        is_ad_hoc: item.is_ad_hoc || false,
        is_added_after_approval: item.is_added_after_approval || false,
        coverage: null,
        coverage_status: null,
        is_approved: null,
        is_primary: false
      }))

      try {
        const parsedServices = JSON.parse(linkedPendingRequest.services || "[]")
        if (Array.isArray(parsedServices) && parsedServices.length > 0) {
          // Prefer parsed JSON because it carries is_primary / coverage flags.
          pendingServices = parsedServices.map((service: any, index: number) => ({
            id: service.id || service.service_id || `pending-${index}`,
            service_name: service.service_name || service.name || "Service",
            service_amount: Number(service.amount ?? service.service_amount ?? 0),
            quantity: Number(service.quantity) || 1,
            line_total: (Number(service.amount ?? service.service_amount ?? 0) * (Number(service.quantity) || 1)),
            is_ad_hoc: service.is_ad_hoc === true,
            is_added_after_approval: service.is_added_after_approval === true || service.is_added_later === true,
            coverage: service.coverage || null,
            coverage_status: service.coverage_status || null,
            is_approved: typeof service.is_approved === "boolean" ? service.is_approved : null,
            is_primary: service.is_primary === true
          }))
        } else {
          pendingServices = requestItemServices
        }
      } catch {
        pendingServices = requestItemServices
      }

      // Only keep truly pending secondary services in this block.
      // This prevents already approved/auto-approved rows from appearing as pending.
      pendingServices = pendingServices.filter((service: any) => {
        const coverage = String(service.coverage || service.coverage_status || "").toUpperCase()
        const isApprovedCoverage =
          coverage === "COVERED" || coverage === "EXCEEDED" || coverage === "LIMIT_EXCEEDED"
        const isExplicitlyApproved = service.is_approved === true
        const isPrimary = service.is_primary === true
        return !isPrimary && !isApprovedCoverage && !isExplicitlyApproved
      })

      // Deduplicate rows that may appear multiple times in legacy payloads.
      const seen = new Set<string>()
      pendingServices = pendingServices.filter((service: any) => {
        const key = `${String(service.service_name || "").toLowerCase()}|${Number(service.service_amount || 0)}|${Number(service.quantity || 1)}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }

    // Also look for wholly-REJECTED add-service requests linked to this code
    // (wholesale rejection: call centre rejected without approving any service)
    const linkedRejectedRequest = await prisma.providerRequest.findFirst({
      where: {
        status: "REJECTED",
        enrollee_id: approvalCode.enrollee_id,
        OR: pendingRequestOrFilters
      },
      include: {
        request_items: { orderBy: { created_at: "asc" } }
      },
      orderBy: { created_at: "desc" }
    })

    // Build rejected-add-services list:
    // Case A — wholly rejected (REJECTED ProviderRequest)
    let rejectedAddedServices: any[] = []
    let rejectedAddReason: string | null = null

    const linkedRejectedRequestServices = linkedRejectedRequest
      ? parseServices(linkedRejectedRequest.services)
      : []
    const linkedRejectedRequestIsAddService = !!linkedRejectedRequest && (
      /Additional services for approval code:/i.test(linkedRejectedRequest.diagnosis || "") ||
      linkedRejectedRequestServices.some((service: any) =>
        service?.is_added_after_approval === true || service?.is_added_later === true
      )
    )

    if (linkedRejectedRequest) {
      let rejReason = linkedRejectedRequest.rejection_reason || null
      if (rejReason) {
        try {
          const parsed = JSON.parse(rejReason)
          if (parsed.overall_remarks) rejReason = parsed.overall_remarks
        } catch { /* plain string */ }
      }
      rejectedAddReason = rejReason

      try {
        if (linkedRejectedRequestServices.length > 0) {
          rejectedAddedServices = linkedRejectedRequestServices
            .filter((s: any) => s.is_added_after_approval === true || s.is_added_later === true)
            .map((s: any, i: number) => ({
              id: s.id || s.service_id || `rej-${i}`,
              service_name: s.service_name || s.name || "Service",
              service_amount: Number(s.amount ?? s.service_amount ?? 0),
              quantity: Number(s.quantity) || 1,
              coverage: 'NOT_COVERED',
              rejection_reason: rejReason
            }))
        }
      } catch { /* ignore */ }
    }

    // Case B — partially approved (rejected entries stored in approvalCode.services JSON)
    if (rejectedAddedServices.length === 0) {
      try {
        const allCodeServices = parseServices(approvalCode.services)
        if (Array.isArray(allCodeServices)) {
          const caseB = allCodeServices.filter((s: any) => {
            const cov = String(s.coverage || '').toUpperCase()
            return (s.is_added_after_approval === true || s.is_added_later === true) &&
              (cov === 'NOT_COVERED' || cov === 'REJECTED')
          })
          rejectedAddedServices = caseB.map((s: any, i: number) => ({
            id: s.id || s.service_id || `rej-b-${i}`,
            service_name: s.service_name || s.name || "Service",
            service_amount: Number(s.amount ?? s.service_amount ?? 0),
            quantity: Number(s.quantity) || 1,
            coverage: 'NOT_COVERED',
            rejection_reason: s.rejection_reason || null
          }))
          if (caseB.length > 0 && !rejectedAddReason) {
            rejectedAddReason = caseB[0]?.rejection_reason || null
          }
        }
      } catch { /* ignore */ }
    }

    const approvalCodeServices = parseServices(approvalCode.services)
    const shouldOverrideWithRejectedRequest =
      !!linkedRejectedRequest &&
      !linkedRejectedRequestIsAddService &&
      linkedRejectedRequestServices.length > 0

    const effectiveServices = shouldOverrideWithRejectedRequest
      ? linkedRejectedRequestServices
      : approvalCodeServices

    const approvedInitialServices = effectiveServices
      .filter((service: any) =>
        !service?.is_added_after_approval &&
        !service?.is_added_later &&
        isApprovedService(service)
      )
      .map(mapDisplayService)

    const approvedAddedServices = effectiveServices
      .filter((service: any) =>
        (service?.is_added_after_approval === true || service?.is_added_later === true) &&
        isApprovedService(service)
      )
      .map(mapDisplayService)

    const rejectedInitialServices = effectiveServices
      .filter((service: any) =>
        !service?.is_added_after_approval &&
        !service?.is_added_later &&
        isRejectedService(service)
      )
      .map(mapDisplayService)

    const fallbackInitialServices = approvalCode.service_items
      .filter(s => s.is_initial)
      .map((service) => ({
        id: service.id,
        service_name: service.service_name,
        service_amount: service.service_amount,
        quantity: service.quantity,
        line_total: Number(service.service_amount) * (Number(service.quantity) || 1),
        added_at: service.added_at
      }))

    const fallbackAddedServices = approvalCode.service_items
      .filter(s => !s.is_initial)
      .map((service) => ({
        id: service.id,
        service_name: service.service_name,
        service_amount: service.service_amount,
        quantity: service.quantity,
        line_total: Number(service.service_amount) * (Number(service.quantity) || 1),
        added_at: service.added_at,
        added_by: service.added_by
          ? `${service.added_by.first_name} ${service.added_by.last_name}`
          : `${approvalCode.generated_by?.first_name || ""} ${approvalCode.generated_by?.last_name || ""}`.trim() || "System"
      }))

    const hasDerivedInitialServices = approvedInitialServices.length > 0 || rejectedInitialServices.length > 0
    const hasDerivedAddedServices = approvedAddedServices.length > 0

    const initialServices = hasDerivedInitialServices
      ? approvedInitialServices
      : fallbackInitialServices
    const addedServices = hasDerivedAddedServices
      ? approvedAddedServices
      : fallbackAddedServices
    const displayServiceItems = [...initialServices, ...addedServices]

    const effectiveStatus = shouldOverrideWithRejectedRequest ? "REJECTED" : approvalCode.status
    const effectiveAmount = effectiveStatus === "REJECTED" ? 0 : approvalCode.amount
    const effectiveRejectionReason =
      rejectedAddReason ||
      linkedRejectedRequest?.rejection_reason ||
      null

    return NextResponse.json({
      success: true,
      approval_code: {
        id: approvalCode.id,
        approval_code: approvalCode.approval_code,
        enrollee_id: approvalCode.enrollee_id,
        enrollee_name: displayEnrolleeName,
        hospital: approvalCode.hospital,
        provider_id: providerId,
        diagnosis: approvalCode.diagnosis,
        clinical_encounter: approvalCode.clinical_encounter,
        admission_required: approvalCode.admission_required,
        status: effectiveStatus,
        amount: effectiveAmount,
        services: JSON.stringify(effectiveServices.length > 0 ? effectiveServices : approvalCodeServices),
        all_services: JSON.stringify(effectiveServices.length > 0 ? effectiveServices : approvalCodeServices),
        rejection_reason: effectiveRejectionReason,
        created_at: approvalCode.created_at,
        updated_at: approvalCode.updated_at,
        add_service_window_started_at: addServiceWindow.windowStartedAt?.toISOString() || null,
        add_service_expires_at: addServiceWindow.expiresAt?.toISOString() || null,
        add_service_seconds_remaining: addServiceWindow.remainingSeconds,
        add_service_window_expired: addServiceWindow.isExpired,
        enrollee: approvalCode.enrollee
          ? {
              ...approvalCode.enrollee,
              first_name: liveDependent?.first_name || approvalCode.enrollee.first_name,
              last_name: liveDependent?.last_name || approvalCode.enrollee.last_name
            }
          : approvalCode.enrollee,
        generated_by: approvalCode.generated_by,
        initial_services: initialServices,
        added_services: addedServices,
        rejected_initial_services: rejectedInitialServices,
        service_items: displayServiceItems.map((service) => ({
          ...service,
          is_initial: !effectiveServices.some((raw: any) =>
            (raw.id || raw.service_id) === service.id &&
            (raw.is_added_after_approval === true || raw.is_added_later === true)
          ),
          added_by: null
        })),
        pending_request_id: linkedPendingRequest?.id || null,
        pending_services: pendingServices,
        pending_services_count: pendingServices.length,
        rejected_added_services: rejectedAddedServices,
        rejected_add_reason: rejectedAddReason
      }
    })

  } catch (error) {
    console.error("Error fetching approval code details:", error)
    return NextResponse.json(
      { error: "Failed to fetch approval code details" },
      { status: 500 }
    )
  }
}
