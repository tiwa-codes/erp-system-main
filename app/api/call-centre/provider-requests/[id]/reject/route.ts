import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

const parseServices = (raw: string | null | undefined) => {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const isPrimaryAutoApprovedRequest = (services: any[], status: string, diagnosis?: string | null) => {
  if (status !== "APPROVED") return false
  if ((diagnosis || "").match(/Additional services for approval code:/i)) return false
  if (!services.length) return false

  return services.every((service) => {
    if (service?.is_primary === true) return true
    return Number(service?.service_type) === 1
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has call-centre permissions
    const hasPermission = await checkPermission(session.user.role as any, "call-centre", "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { reason } = body

    console.log('Reject request body:', body)
    console.log('Request ID:', id)
    console.log('Rejection reason:', reason)

    // Validate rejection reason is provided and not empty
    if (!reason || !reason.trim()) {
      return NextResponse.json({
        error: "Rejection reason is required. Please provide a reason for rejecting this request."
      }, { status: 400 })
    }

    // Find the provider request
    const providerRequest = await prisma.providerRequest.findUnique({
      where: { id },
      include: {
        request_items: {
          orderBy: { created_at: "asc" }
        },
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

    if (!providerRequest) {
      return NextResponse.json({ error: "Provider request not found" }, { status: 404 })
    }

    // Check if the request is in a valid state for rejection
    if (providerRequest.status === 'REJECTED') {
      return NextResponse.json({
        error: "Request has already been rejected."
      }, { status: 400 })
    }

    const rejectionReason = reason.trim() || 'Rejected by call centre'
    const parsedServices = parseServices(providerRequest.services)

    const requestServices = parsedServices.length > 0
      ? parsedServices
      : providerRequest.request_items.map((item) => ({
        id: item.id,
        service_id: item.id,
        service_name: item.service_name,
        amount: Number(item.service_amount),
        quantity: Number(item.quantity) || 1,
        tariff_price: item.tariff_price ? Number(item.tariff_price) : null,
        is_ad_hoc: item.is_ad_hoc || false,
        is_added_after_approval: item.is_added_after_approval || false,
        category_id: item.category || null,
      }))

    const isPrimaryAutoApproved = isPrimaryAutoApprovedRequest(
      requestServices,
      providerRequest.status,
      providerRequest.diagnosis
    )

    if (providerRequest.status === 'APPROVED' && !isPrimaryAutoApproved) {
      return NextResponse.json({
        error: "Cannot reject an approved request. Request has already been approved."
      }, { status: 400 })
    }

    const rejectedServices = requestServices.map((service: any) => ({
      ...service,
      is_approved: false,
      coverage: 'REJECTED',
      coverage_status: 'REJECTED',
      remarks: service.remarks || service.rejection_reason || rejectionReason,
      rejection_reason: service.rejection_reason || service.remarks || rejectionReason,
    }))

    const rejectedServicesData = rejectedServices.map((service: any) => ({
      service_name: service.service_name || service.name || 'Unknown Service',
      quantity: Number(service.quantity) || 1,
      service_amount: (Number(service.amount ?? service.service_amount ?? 0) || 0) * (Number(service.quantity) || 1),
      unit_amount: Number(service.amount ?? service.service_amount ?? 0) || 0,
      rejection_reason: service.rejection_reason || rejectionReason,
      rejected_by_id: session.user.id,
      rejected_by_name: session.user.name || 'Call Centre',
      rejection_date: new Date().toISOString(),
      coverage: 'REJECTED'
    }))

    const rejectionPayload = JSON.stringify({
      rejected_services: rejectedServicesData,
      overall_remarks: rejectionReason,
      rejected_count: rejectedServices.length,
      rejection_date: new Date().toISOString()
    })

    const linkedApprovalCode = providerRequest.claim_id
      ? await prisma.approvalCode.findFirst({
        where: {
          claim_id: providerRequest.claim_id,
          enrollee_id: providerRequest.enrollee_id,
          is_deleted: false
        },
        orderBy: { created_at: 'desc' }
      })
      : await prisma.approvalCode.findFirst({
        where: {
          enrollee_id: providerRequest.enrollee_id,
          approval_code: {
            in: (providerRequest.diagnosis || "")
              .match(/Additional services for approval code:\s*([A-Z0-9\/-]+)/i)
              ?.slice(1) || []
          },
          is_deleted: false
        }
      })

    const updatedRequest = await prisma.$transaction(async (tx) => {
      const requestUpdate = await tx.providerRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          services: JSON.stringify(rejectedServices),
          amount: 0,
          rejection_reason: rejectionPayload
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

      if (linkedApprovalCode) {
        const existingCodeServices = parseServices(linkedApprovalCode.services)
        const normalizedRejectedCodeServices = existingCodeServices.map((service: any) => ({
          ...service,
          is_approved: false,
          coverage: 'REJECTED',
          coverage_status: 'REJECTED',
          remarks: service.remarks || service.rejection_reason || rejectionReason,
          rejection_reason: service.rejection_reason || service.remarks || rejectionReason,
        }))

        await tx.approvalCode.update({
          where: { id: linkedApprovalCode.id },
          data: {
            status: 'REJECTED',
            amount: 0,
            services: JSON.stringify(normalizedRejectedCodeServices)
          }
        })

        await tx.approvalCodeTimeline.create({
          data: {
            approval_code_id: linkedApprovalCode.id,
            stage: 'REJECTED',
            timestamp: new Date(),
            user_id: session.user.id,
            delay_minutes: 0
          }
        })

        if (linkedApprovalCode.claim_id) {
          await tx.claim.update({
            where: { id: linkedApprovalCode.claim_id },
            data: {
              status: 'REJECTED',
              amount: 0,
              approved_amount: 0,
              rejected_at: new Date(),
              rejection_reason: rejectionReason,
              current_stage: null
            }
          })
        }
      } else if (providerRequest.claim_id) {
        await tx.claim.update({
          where: { id: providerRequest.claim_id },
          data: {
            status: 'REJECTED',
            amount: 0,
            approved_amount: 0,
            rejected_at: new Date(),
            rejection_reason: rejectionReason,
            current_stage: null
          }
        })
      }

      return requestUpdate
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "PROVIDER_REQUEST_REJECTED",
        resource: "provider_request",
        resource_id: providerRequest.id,
        old_values: providerRequest,
        new_values: updatedRequest
      }
    })

    return NextResponse.json({
      success: true,
      message: "Request rejected successfully",
      provider_request: {
        id: updatedRequest.id,
        request_id: updatedRequest.request_id,
        provider_name: updatedRequest.provider.facility_name,
        hospital_name: updatedRequest.hospital,
        services: updatedRequest.services,
        amount: updatedRequest.amount,
        status: updatedRequest.status,
        rejection_reason: updatedRequest.rejection_reason,
        date: updatedRequest.created_at
      }
    })

  } catch (error) {
    console.error("Error rejecting provider request:", error)
    return NextResponse.json(
      { error: "Failed to reject provider request" },
      { status: 500 }
    )
  }
}
