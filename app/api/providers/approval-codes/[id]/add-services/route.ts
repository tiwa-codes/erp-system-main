import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { getAddServiceWindowMeta } from "@/lib/add-service-window"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has provider edit/add permissions
    const canEdit = await checkPermission(session.user.role as any, "provider", "edit")
    const canAdd = await checkPermission(session.user.role as any, "provider", "add")
    if (!canEdit && !canAdd) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { services, comment, diagnosis } = body
    const normalizedComment = (comment || "").toString().trim()
    const normalizedDiagnosis = (diagnosis || "").toString().trim()

    if (!services || !Array.isArray(services) || services.length === 0) {
      return NextResponse.json({
        error: "Services array is required and must not be empty"
      }, { status: 400 })
    }

    if (!normalizedComment) {
      return NextResponse.json({
        error: "Comment is required when adding services"
      }, { status: 400 })
    }

    const normalizedServices = services.map((service: any, index: number) => {
      const serviceName = (service.service_name || service.name || "").toString().trim()
      const quantity = Math.max(1, parseInt(service.quantity?.toString() || "1", 10) || 1)
      const unitPriceRaw =
        service.unit_price ??
        service.service_amount ??
        service.amount ??
        0
      const unitPrice = Number(unitPriceRaw) || 0
      const serviceId = service.service_id || service.id || null
      const isAdHoc = service.is_ad_hoc === true || !serviceId
      const lineTotal = unitPrice * quantity
      const categoryId = (service.category_id || (service.service_category === "Drugs / Pharmaceuticals" ? "DRG" : "SER") || "SER").toString()
      const serviceCategory = (service.service_category || (categoryId === "DRG" ? "Drugs / Pharmaceuticals" : "Medical Services")).toString()
      const serviceType = typeof service.service_type === "number" ? service.service_type : null

      return {
        index,
        service_name: serviceName,
        service_id: serviceId,
        quantity,
        unit_price: unitPrice,
        service_amount: unitPrice,
        line_total: lineTotal,
        is_ad_hoc: isAdHoc,
        is_added_after_approval: true,
        category_id: categoryId,
        service_category: serviceCategory,
        service_type: serviceType
      }
    })

    // Validate normalized services
    for (const service of normalizedServices) {
      if (!service.service_name) {
        return NextResponse.json({
          error: `Service name is required for item ${service.index + 1}`
        }, { status: 400 })
      }
      if (service.quantity < 1) {
        return NextResponse.json({
          error: `Quantity must be at least 1 for ${service.service_name}`
        }, { status: 400 })
      }
      if (service.unit_price < 0) {
        return NextResponse.json({
          error: `Price cannot be negative for ${service.service_name}`
        }, { status: 400 })
      }
    }

    // Find the approval code
    const approvalCode = await prisma.approvalCode.findUnique({
      where: { id },
      include: {
        timeline: {
          where: { stage: "APPROVED" },
          orderBy: { timestamp: "asc" },
          take: 1,
          select: { timestamp: true }
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
      return NextResponse.json({ error: "Approval code not found" }, { status: 404 })
    }

    // Only allow adding services to APPROVED or PARTIAL codes
    if (approvalCode.status !== 'APPROVED' && approvalCode.status !== 'PARTIAL') {
      return NextResponse.json({
        error: `Cannot add services to ${approvalCode.status} approval codes. Only APPROVED or PARTIAL codes can be updated.`
      }, { status: 400 })
    }

    const addServiceWindow = getAddServiceWindowMeta({
      createdAt: approvalCode.created_at,
      approvedAt: approvalCode.timeline[0]?.timestamp || null
    })
    if (addServiceWindow.isExpired) {
      return NextResponse.json({
        error: "Add service window has expired. Services can only be added within 24 hours of approval."
      }, { status: 400 })
    }

    // Get user's provider information to verify they own this approval code
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { provider: true }
    })

    if (!user?.provider_id) {
      return NextResponse.json({
        error: "User account not linked to a provider facility"
      }, { status: 400 })
    }

    if (approvalCode.provider_id && approvalCode.provider_id !== user.provider_id) {
      return NextResponse.json({
        error: "You do not have permission to add services to this approval code"
      }, { status: 403 })
    }

    // Calculate total amount of new services (unit price × quantity)
    const newServicesAmount = normalizedServices.reduce((sum, service) => {
      return sum + service.line_total
    }, 0)

    // Prepare services payload with flags for Call Centre view
    const servicesWithFlags = normalizedServices.map(service => ({
      service_id: service.service_id,
      id: service.service_id || `adhoc-${service.index}`,
      service_name: service.service_name,
      quantity: service.quantity,
      amount: service.unit_price,
      service_amount: service.service_amount,
      unit_price: service.unit_price,
      line_total: service.line_total,
      is_ad_hoc: service.is_ad_hoc,
      is_added_after_approval: true,
      category_id: service.category_id,
      service_category: service.service_category,
      service_type: service.service_type,
      provider_additional_comment: normalizedComment
    }))

    // Build the linked diagnosis string that the approve route will use to locate the
    // original approval code and append newly-approved services to it.
    const fallbackDiagnosis = (approvalCode.diagnosis || "")
      .replace(/Additional services for approval code:\s*[A-Z0-9\/-]+\.?\s*/gi, "")
      .trim()
    const nextDiagnosis = normalizedDiagnosis || fallbackDiagnosis
    const linkedDiagnosis = `Additional services for approval code: ${approvalCode.approval_code}. ${nextDiagnosis}`.trim()

    const requestItemsToCreate = normalizedServices.map((service) => ({
      service_name: service.service_name,
      service_amount: service.service_amount,
      quantity: service.quantity,
      is_ad_hoc: service.is_ad_hoc,
      is_added_after_approval: true,
      tariff_price: service.is_ad_hoc ? null : service.service_amount,
      category: service.category_id
    }))

    const includeShape = {
      provider: { select: { id: true, facility_name: true, facility_type: true } },
      enrollee: { select: { id: true, enrollee_id: true, first_name: true, last_name: true } }
    }

    let providerRequest: any = null

    // ── STRATEGY 1 ────────────────────────────────────────────────────────────
    // Find the SPECIFIC APPROVED / PARTIAL ProviderRequest that produced THIS
    // approval code.  We must be precise: match by claim_id (most reliable) OR
    // by the approval_code string embedded in diagnosis. Using broad
    // enrollee+provider queries would pick up unrelated prior requests and
    // create spurious duplicate PENDING rows.
    let existingApprovedRequest = null

    // 1a. Match by claim_id — most reliable since approval code → claim → provider request
    if (approvalCode.claim_id) {
      existingApprovedRequest = await prisma.providerRequest.findFirst({
        where: {
          status: { in: ["APPROVED", "PARTIAL"] },
          provider_id: user.provider_id,
          claim_id: approvalCode.claim_id,
        },
        include: { request_items: { orderBy: { created_at: "asc" } } },
        orderBy: { created_at: "desc" }
      })
    }

    // 1b. Fallback: match by approval code referenced in diagnosis
    if (!existingApprovedRequest) {
      existingApprovedRequest = await prisma.providerRequest.findFirst({
        where: {
          status: { in: ["APPROVED", "PARTIAL"] },
          provider_id: user.provider_id,
          enrollee_id: approvalCode.enrollee_id,
          OR: [
            { diagnosis: { contains: approvalCode.approval_code, mode: "insensitive" } },
            // Last-resort: both provider and enrollee match AND created around the same day
            {
              AND: [
                { enrollee_id: approvalCode.enrollee_id },
                { created_at: { gte: new Date(approvalCode.created_at.getTime ? approvalCode.created_at.getTime() - 24*60*60*1000 : Date.now() - 24*60*60*1000) } }
              ]
            }
          ]
        },
        include: { request_items: { orderBy: { created_at: "asc" } } },
        orderBy: { created_at: "desc" }
      })
    }

    if (existingApprovedRequest) {
      // Merge existing services (already approved — keep as-is) with the new ones
      let existingServices: any[] = []
      try {
        const parsed = JSON.parse(existingApprovedRequest.services || "[]")
        existingServices = Array.isArray(parsed) ? parsed : []
      } catch { existingServices = [] }

      // Exclude previously-rejected services so they don't resurface as pending
      const approvedExistingServices = existingServices.filter((s: any) => {
        const cov = String(s.coverage || s.coverage_status || '').toUpperCase()
        return cov !== 'NOT_COVERED' && cov !== 'REJECTED' && s.is_approved !== false
      })
      const mergedServices = [...approvedExistingServices, ...servicesWithFlags]

      // Build the updated diagnosis — strip any prior reference then re-prefix with the
      // current approval code so the approve route can always resolve it.
      const originalDiagnosis = (existingApprovedRequest.diagnosis || "")
        .replace(/Additional services for approval code:\s*[A-Z0-9\/-]+\.?\s*/gi, "")
        .trim()
      const updatedDiagnosis = `Additional services for approval code: ${approvalCode.approval_code}. ${normalizedDiagnosis || originalDiagnosis || fallbackDiagnosis}`.trim()

      providerRequest = await prisma.providerRequest.update({
        where: { id: existingApprovedRequest.id },
        data: {
          status: "PENDING",
          amount: Number(existingApprovedRequest.amount) + newServicesAmount,
          services: JSON.stringify(mergedServices),
          diagnosis: updatedDiagnosis,
          request_items: { create: requestItemsToCreate }
        },
        include: includeShape
      })
    } else {
      // ── STRATEGY 2 ──────────────────────────────────────────────────────────
      // If the original approved request was not found (edge case) check for an
      // already-pending request for this approval code and append to it.
      const existingPendingRequest = await prisma.providerRequest.findFirst({
        where: {
          status: "PENDING",
          enrollee_id: approvalCode.enrollee_id,
          diagnosis: { contains: approvalCode.approval_code, mode: "insensitive" }
        },
        include: { request_items: { orderBy: { created_at: "asc" } } },
        orderBy: { created_at: "desc" }
      })

      if (existingPendingRequest) {
        let existingServices: any[] = []
        try {
          const parsed = JSON.parse(existingPendingRequest.services || "[]")
          existingServices = Array.isArray(parsed) ? parsed : []
        } catch { existingServices = [] }

        // Exclude previously-rejected services so they don't resurface as pending
        const approvedExistingServices = existingServices.filter((s: any) => {
          const cov = String(s.coverage || s.coverage_status || '').toUpperCase()
          return cov !== 'NOT_COVERED' && cov !== 'REJECTED' && s.is_approved !== false
        })

        providerRequest = await prisma.providerRequest.update({
          where: { id: existingPendingRequest.id },
          data: {
            amount: Number(existingPendingRequest.amount) + newServicesAmount,
            services: JSON.stringify([...approvedExistingServices, ...servicesWithFlags]),
            diagnosis: linkedDiagnosis,
            request_items: { create: requestItemsToCreate }
          },
          include: includeShape
        })
      } else {
        // ── STRATEGY 3 ────────────────────────────────────────────────────────
        // Absolute fallback — create a brand-new PENDING request.
        providerRequest = await prisma.providerRequest.create({
          data: {
            provider_id: user.provider_id,
            enrollee_id: approvalCode.enrollee_id,
            hospital: approvalCode.hospital,
            services: JSON.stringify(servicesWithFlags),
            amount: newServicesAmount,
            diagnosis: linkedDiagnosis,
            status: 'PENDING',
            request_items: { create: requestItemsToCreate }
          },
          include: includeShape
        })
      }
    }

    // Create audit log for the provider request
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "ADD_SERVICES_REQUEST",
        resource: "provider_request",
        resource_id: providerRequest.id,
        new_values: {
          original_approval_code: approvalCode.approval_code,
          original_approval_code_id: id,
          services: servicesWithFlags,
          amount: newServicesAmount,
          status: 'PENDING',
          details: `Provider requested to add ${normalizedServices.length} service(s) to approval code ${approvalCode.approval_code}. Total amount: ₦${newServicesAmount.toLocaleString()}. Request is now pending Call Centre approval.`,
          provider_comment: normalizedComment
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `Successfully submitted ${normalizedServices.length} service(s) for approval. Request sent to Call Centre.`,
      data: {
        provider_request: {
          id: providerRequest.id,
          request_id: `REQ-${providerRequest.id.slice(-8).toUpperCase()}`,
          status: 'PENDING',
          services_count: normalizedServices.length,
          amount: newServicesAmount,
          comment: normalizedComment
        },
        original_approval_code: approvalCode.approval_code,
        original_approval_code_id: id,
        note: 'These services will be added to the approval code once approved by Call Centre'
      }
    })

  } catch (error) {
    console.error("Error submitting services for approval:", error)
    return NextResponse.json(
      { error: "Failed to submit services for approval" },
      { status: 500 }
    )
  }
}
