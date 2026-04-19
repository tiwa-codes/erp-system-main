import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { generateDailyApprovalCode } from "@/lib/approval-code"
import { enforcePlanUsage } from "@/lib/underwriting/enforcement"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has request-from-provider permissions
    const hasPermission = await checkPermission(session.user.role as any, "request-from-provider", "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { diagnosis, admission_required, services, status, coverage_status, remarks } = body

    // Only generate an approval code when the request is being APPROVED.
    // Do NOT create a code when the entire request is being REJECTED.
    const isRejection = status === 'REJECTED'
    const approvalCode = isRejection ? null : await generateDailyApprovalCode(prisma)

    // Find the provider request
    const providerRequest = await prisma.providerRequest.findUnique({
      where: { id },
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
            status: true,
            organization_id: true,
            end_date: true,
            plan: {
              select: {
                id: true,
                name: true,
                assigned_bands: true,
                band_type: true,
                status: true
              }
            },
            organization: {
              select: {
                id: true,
                name: true,
                status: true
              }
            }
          }
        }
      }
    })

    if (!providerRequest) {
      return NextResponse.json({ error: "Provider request not found" }, { status: 404 })
    }

    // Check if enrollee is active
    if (providerRequest.enrollee?.status !== 'ACTIVE') {
      return NextResponse.json({
        success: false,
        error: "This Enrollee is Inactive. Contact support for more info."
      }, { status: 403 })
    }

    // Check if plan exists and is active
    if (!providerRequest.enrollee?.plan) {
      return NextResponse.json({
        success: false,
        error: "This Enrollee is Inactive. Contact support for more info."
      }, { status: 403 })
    }

    if (providerRequest.enrollee.plan.status !== 'ACTIVE') {
      return NextResponse.json({
        success: false,
        error: "This Enrollee is Inactive. Contact support for more info."
      }, { status: 403 })
    }

    // Check if organization is active
    if (providerRequest.enrollee.organization?.status !== 'ACTIVE') {
      return NextResponse.json({
        success: false,
        error: "This Enrollee is Inactive. Contact support for more info."
      }, { status: 403 })
    }

    // Check if plan has expired (end_date is in the past)
    if (providerRequest.enrollee.end_date && new Date(providerRequest.enrollee.end_date) < new Date()) {
      return NextResponse.json({
        success: false,
        error: "This Enrollee is Inactive. Contact support for more info."
      }, { status: 403 })
    }

    if (!isRejection) {
      const enforcement = await enforcePlanUsage({
        principalId: providerRequest.enrollee_id,
        attemptedAmount: Number(providerRequest.amount || 0),
      })

      if ("error" in enforcement) {
        return NextResponse.json(
          { success: false, error: enforcement.error },
          { status: enforcement.status }
        )
      }

      if (enforcement.isBlocked) {
        await prisma.auditLog.create({
          data: {
            user_id: session.user.id,
            action: "PROVIDER_REQUEST_APPROVAL_BLOCKED",
            resource: "provider_request",
            resource_id: providerRequest.id,
            new_values: {
              reason: enforcement.warnings,
              attempted_amount: Number(providerRequest.amount || 0),
              annual_limit: enforcement.annualLimit,
              total_used: enforcement.totalUsed,
            },
          },
        })

        return NextResponse.json(
          {
            success: false,
            error: enforcement.warnings[0] || "Annual limit has been exhausted. Cannot approve this request.",
            details: {
              annual_limit: enforcement.annualLimit,
              total_used: enforcement.totalUsed,
              warnings: enforcement.warnings,
            },
          },
          { status: 400 }
        )
      }
    }

    // Enhanced band validation - check if enrollee's plan covers this provider with hierarchical access
    if (providerRequest.enrollee?.plan) {
      const enrolleeBands = providerRequest.enrollee.plan.assigned_bands && providerRequest.enrollee.plan.assigned_bands.length > 0 
        ? providerRequest.enrollee.plan.assigned_bands.map(b => `Band ${b.toUpperCase()}`)
        : (providerRequest.enrollee.plan.band_type ? [providerRequest.enrollee.plan.band_type] : ["Band A"])

      // Get provider's assigned bands from PlanBand
      const planBands = await prisma.planBand.findMany({
        where: {
          plan_id: providerRequest.enrollee.plan.id,
          provider_id: providerRequest.provider_id,
          status: 'ACTIVE'
        }
      })

      // Helper function to get accessible bands based on hierarchical access
      const getAccessibleBands = (enrolleeBand: string): string[] => {
        const band = enrolleeBand.toLowerCase().trim()
        
        switch (band) {
          case 'band a':
          case 'a':
            return ['Band A', 'Band B', 'Band C'] // A has access to A, B, C
          case 'band b':
          case 'b':
            return ['Band B', 'Band C'] // B has access to B, C only
          case 'band c':
          case 'c':
            return ['Band C'] // C has access to C only
          default:
            return [enrolleeBand] // Default to same band
        }
      }

      // Helper function to normalize band names for comparison
      const normalizeBand = (band: string): string => {
        const normalized = band.toLowerCase().trim()
        if (normalized === 'a' || normalized === 'band a') return 'Band A'
        if (normalized === 'b' || normalized === 'band b') return 'Band B'
        if (normalized === 'c' || normalized === 'band c') return 'Band C'
        return band // Return original if not recognized
      }

      // If no PlanBand records exist, check provider's selected_bands field
      let providerBands: string[] = []
      let isBandMatch = false

      if (planBands.length === 0) {
        // Check if provider has band information in their selected_bands field
        const providerWithBands = await prisma.provider.findUnique({
          where: { id: providerRequest.provider_id },
          select: {
            id: true,
            facility_name: true,
            facility_type: true,
            selected_bands: true
          }
        })

        if (!providerWithBands) {
          return NextResponse.json({
            success: false,
            error: "Provider not found"
          }, { status: 404 })
        }

        // Use provider's selected_bands if available, otherwise deny access (don't default to all bands)
        if (providerWithBands.selected_bands && providerWithBands.selected_bands.length > 0) {
          // Convert band labels to "Band X" format
          providerBands = providerWithBands.selected_bands.map(band => {
            const normalized = band.toLowerCase().trim()
            if (normalized === 'a' || normalized === 'band a') return 'Band A'
            if (normalized === 'b' || normalized === 'band b') return 'Band B'
            if (normalized === 'c' || normalized === 'band c') return 'Band C'
            // If already in "Band X" format, return as is
            if (band.startsWith('Band ')) return band
            // Otherwise, assume it's a label and try to extract the band
            return `Band ${band.toUpperCase()}`
          })
        } else {
          // If provider has no bands configured, deny access (don't default to all bands)
          return NextResponse.json({
            success: false,
            error: "Access Denied: Provider band configuration not found. Please contact support.",
            details: {
              enrollee_bands: enrolleeBands.join(", "),
              provider_bands: "Not configured",
              hierarchy_info: "Band A → A,B,C | Band B → B,C only | Band C → C only"
            }
          }, { status: 403 })
        }
      } else {
        // Use the PlanBand records
        providerBands = planBands.map(pb => pb.band_type)
      }

      // Check if enrollee's bands have hierarchical access to provider's bands
      isBandMatch = enrolleeBands.some(enrolleeBand => {
        const accessibleBands = getAccessibleBands(enrolleeBand)
        
        const hasMatch = accessibleBands.some(accessibleBand => {
          const normalizedAccessible = normalizeBand(accessibleBand)
          const providerMatch = providerBands.some(providerBand => {
            const normalizedProvider = normalizeBand(providerBand)
            const isMatch = normalizedProvider === normalizedAccessible
            return isMatch
          })
          return providerMatch
        })
        
        return hasMatch
      })

      if (!isBandMatch) {
        const accessibleBandsSummary = enrolleeBands.map(eb => 
          `${eb} (access to: ${getAccessibleBands(eb).join(", ")})`
        ).join(", ")
        
        return NextResponse.json({
          success: false,
          error: `Access Denied: Your plan band does not cover services at this provider level. Enrollee bands: ${accessibleBandsSummary}`,
          details: {
            enrollee_bands: accessibleBandsSummary,
            provider_bands: providerBands.join(", "),
            hierarchy_info: "Band A → A,B,C | Band B → B,C only | Band C → C only"
          }
        }, { status: 403 })
      }
    }

    // Update the provider request status
    const updatedRequest = await prisma.providerRequest.update({
      where: { id },
      data: {
        status: status || 'APPROVED',
        diagnosis: diagnosis || providerRequest.diagnosis,
        admission_required: admission_required !== undefined ? admission_required : providerRequest.admission_required,
        services: services || providerRequest.services,
        rejection_reason: status === 'REJECTED' ? remarks : null
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

    let approvalCodeRecord = null

    // Only create approval code and claim when the request is APPROVED (not REJECTED)
    if (!isRejection && approvalCode) {
      // Create an approval code record
      approvalCodeRecord = await prisma.approvalCode.create({
        data: {
          approval_code: approvalCode,
          enrollee_id: providerRequest.enrollee_id,
          enrollee_name: providerRequest.enrollee ? 
            `${providerRequest.enrollee.first_name} ${providerRequest.enrollee.last_name}` : 
            'Unknown',
          hospital: providerRequest.hospital,
          services: services || providerRequest.services,
          amount: providerRequest.amount,
          diagnosis: diagnosis || providerRequest.diagnosis || '',
          status: 'ACTIVE',
          generated_by_id: session.user.id
        },
        include: {
          enrollee: {
            select: {
              id: true,
              enrollee_id: true,
              first_name: true,
              last_name: true
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

      // 🚀 AUTOMATIC CLAIM CREATION - CORRECTED WORKFLOW
      // When Call Centre approves a code → it should come to Claims Request as NEW
      // This matches the corrected workflow: NEW → PENDING → PAID
      
      try {
        // Generate unique claim number
        const claimNumber = `CLM-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
        
        // Create claim with NEW status (as per corrected workflow)
        const newClaim = await prisma.claim.create({
          data: {
            claim_number: claimNumber,
            enrollee_id: providerRequest.enrollee?.enrollee_id || providerRequest.enrollee_id, // Use actual enrollee_id, not PrincipalAccount.id
            principal_id: providerRequest.enrollee?.id || null,
            provider_id: providerRequest.provider_id,
            claim_type: 'MEDICAL',
            amount: providerRequest.amount || 0,
            status: 'NEW', // Start as NEW when created from approval code
            submitted_at: new Date(),
            created_by_id: session.user.id,
          }
        })
        
        // Link the approval code to the claim
        await prisma.approvalCode.update({
          where: { id: approvalCodeRecord!.id },
          data: {
            claim_id: newClaim.id
          }
        })
        
        console.log(`✅ Created claim ${newClaim.claim_number} with NEW status for approved request`)
        
      } catch (error) {
        console.error('Error creating automatic claim:', error)
        // Don't fail the approval if claim creation fails
      }
    }

    // Create audit logs
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: isRejection ? "PROVIDER_REQUEST_REJECTED" : "PROVIDER_REQUEST_APPROVED",
        resource: "provider_request",
        resource_id: providerRequest.id,
        old_values: providerRequest,
        new_values: updatedRequest
      }
    })

    if (isRejection) {
      return NextResponse.json({
        success: true,
        message: "Request rejected successfully.",
        approval_code: null,
        provider_request: {
          id: updatedRequest.id,
          request_id: updatedRequest.request_id,
          provider_name: updatedRequest.provider.facility_name,
          hospital_name: updatedRequest.hospital,
          services: updatedRequest.services,
          amount: updatedRequest.amount,
          status: updatedRequest.status,
          date: updatedRequest.created_at
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: "Request approved successfully. Claim created and sent to Claims Request.",
      approval_code: approvalCode,
      provider_request: {
        id: updatedRequest.id,
        request_id: updatedRequest.request_id,
        provider_name: updatedRequest.provider.facility_name,
        hospital_name: updatedRequest.hospital,
        services: updatedRequest.services,
        amount: updatedRequest.amount,
        status: updatedRequest.status,
        date: updatedRequest.created_at
      }
    })

  } catch (error) {
    console.error("Error approving provider request:", error)
    return NextResponse.json(
      { error: "Failed to approve provider request" },
      { status: 500 }
    )
  }
}
