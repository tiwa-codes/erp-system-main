import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { sendApprovalCodeServicesAdded } from "@/lib/notifications"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has call-centre edit permissions
    const hasPermission = await checkPermission(session.user.role as any, "call-centre", "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { services } = body

    if (!services || !Array.isArray(services) || services.length === 0) {
      return NextResponse.json({ 
        error: "Services array is required and must not be empty" 
      }, { status: 400 })
    }

    // Validate each service has required fields
    for (const service of services) {
      if (!service.service_name || !service.service_amount) {
        return NextResponse.json({ 
          error: "Each service must have service_name and service_amount" 
        }, { status: 400 })
      }
    }

    // Find the approval code
    const approvalCode = await prisma.approvalCode.findUnique({
      where: { id },
      include: {
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

    // Calculate total amount of new services
    const newServicesAmount = services.reduce((sum, service) => {
      return sum + parseFloat(service.service_amount.toString())
    }, 0)

    // Create service records with is_initial=false
    const serviceRecords = await prisma.approvalCodeService.createMany({
      data: services.map(service => ({
        approval_code_id: id,
        service_name: service.service_name,
        service_amount: service.service_amount,
        is_initial: false,
        added_by_id: session.user.id
      }))
    })

    // Update approval code amount (add new services to existing amount)
    const updatedApprovalCode = await prisma.approvalCode.update({
      where: { id },
      data: {
        amount: {
          increment: newServicesAmount
        },
        updated_at: new Date()
      }
    })

    // Parse existing services from JSON string
    let existingServices: any[] = []
    try {
      existingServices = JSON.parse(approvalCode.services)
    } catch {
      existingServices = [{ service_name: approvalCode.services, service_amount: approvalCode.amount }]
    }

    // Add new services to the services JSON string
    const updatedServices = [
      ...existingServices,
      ...services
    ]

    // Update the services field with all services
    await prisma.approvalCode.update({
      where: { id },
      data: {
        services: JSON.stringify(updatedServices)
      }
    })

    // Update associated claim if it exists (before claims are sent)
    if (approvalCode.claim_id) {
      try {
        // Find the claim
        const claim = await prisma.claim.findUnique({
          where: { id: approvalCode.claim_id },
          include: {
            approval_codes: {
              include: {
                service_items: true
              }
            }
          }
        })

        if (claim && !['VETTED', 'VETTER1_COMPLETED', 'VETTER2_COMPLETED', 'AUDIT_COMPLETED', 'APPROVED', 'REJECTED', 'PAID'].includes(claim.status)) {
          // Only update claim amount while it hasn't been processed yet
          // (works for SUBMITTED, UNDER_REVIEW, VETTING — i.e. manual claims auto-dropped in Vetter 1)
          // Calculate total amount from ALL approval codes' services for this claim
          const allApprovalCodeIds = claim.approval_codes.map(ac => ac.id)
          const allApprovalCodeServices = await prisma.approvalCodeService.findMany({
            where: {
              approval_code_id: { in: allApprovalCodeIds }
            }
          })

          const totalAmount = allApprovalCodeServices.reduce((sum, service) => {
            return sum + parseFloat(service.service_amount.toString())
          }, 0)

          // Update claim amount
          await prisma.claim.update({
            where: { id: approvalCode.claim_id },
            data: {
              amount: totalAmount,
              updated_at: new Date()
            }
          })

          console.log(`✅ Updated claim ${claim.claim_number} amount to ₦${totalAmount.toLocaleString()} (from ${allApprovalCodeServices.length} services across ${allApprovalCodeIds.length} approval codes)`)
        }
      } catch (claimError) {
        console.error("Error updating associated claim:", claimError)
        // Don't fail the request if claim update fails
      }
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "ADD_SERVICES_TO_APPROVAL_CODE",
        resource: "approval_code",
        resource_id: id,
        old_values: {
          services: approvalCode.services,
          amount: approvalCode.amount.toString()
        },
        new_values: {
          services: JSON.stringify(updatedServices),
          amount: updatedApprovalCode.amount.toString(),
          added_services: services,
          details: `Added ${services.length} service(s) to approval code ${approvalCode.approval_code}. Total new amount: ₦${newServicesAmount.toLocaleString()}`
        }
      }
    })

    // Send email notification to enrollee
    if (approvalCode.enrollee?.email) {
      try {
        await sendApprovalCodeServicesAdded(
          `${approvalCode.enrollee.first_name} ${approvalCode.enrollee.last_name}`,
          approvalCode.enrollee.email,
          approvalCode.approval_code,
          approvalCode.hospital,
          services,
          newServicesAmount,
          updatedApprovalCode.amount.toNumber()
        )
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError)
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully added ${services.length} service(s) to approval code`,
      data: {
        approval_code: approvalCode.approval_code,
        services_added: services.length,
        new_services_amount: newServicesAmount,
        total_amount: updatedApprovalCode.amount,
        added_services: services
      }
    })

  } catch (error) {
    console.error("Error adding services to approval code:", error)
    return NextResponse.json(
      { error: "Failed to add services to approval code" },
      { status: 500 }
    )
  }
}
