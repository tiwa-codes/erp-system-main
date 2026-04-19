import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { getEnrolleeUtilization } from "@/lib/underwriting/usage"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Internal Control audit users open the same claim detail screen through
    // operation-desk/audit, so allow either claims:view or operation-desk audit.
    const [canViewClaims, canViewInternalControlAudit] = await Promise.all([
      checkPermission(session.user.role as any, "claims", "view"),
      checkPermission(session.user.role as any, "operation-desk", "view", "audit"),
    ])
    if (!canViewClaims && !canViewInternalControlAudit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const claimId = params.id

    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
      select: {
        id: true,
        claim_number: true,
        enrollee_id: true,
        principal_id: true,
        provider_id: true,
        claim_type: true,
        amount: true,
        original_amount: true,
        approved_amount: true,
        status: true,
        current_stage: true,
        submitted_at: true,
        processed_at: true,
        approved_at: true,
        rejected_at: true,
        rejection_reason: true,
        created_at: true,
        updated_at: true,
        description: true,
        principal: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            middle_name: true,
            enrollee_id: true,
            phone_number: true,
            email: true,
            gender: true,
            age: true,
            start_date: true,
            end_date: true,
            account_type: true,
            primary_hospital: true,
            organization: {
              select: {
                id: true,
                name: true,
                code: true
              }
            },
            plan: {
              select: {
                id: true,
                name: true,
                plan_type: true,
                premium_amount: true,
                annual_limit: true
              }
            }
          }
        },
        provider: {
          select: {
            id: true,
            facility_name: true,
            facility_type: true,
            address: true,
            phone_whatsapp: true,
            email: true
          }
        },
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        },
        approval_codes: {
          where: { is_deleted: false },
          select: {
            id: true,
            approval_code: true,
            beneficiary_id: true,
            diagnosis: true,
            clinical_encounter: true,
            services: true,
            created_at: true,
            service_items: {
              select: {
                id: true,
                service_name: true,
                service_amount: true,
                quantity: true,
                is_ad_hoc: true,
                tariff_price: true,
                added_at: true,
                is_initial: true,
                vetted_amount: true,
                is_vetted_approved: true,
                rejection_reason: true,
                category: true,
                is_deleted: true,
                added_by: {
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true
                  }
                }
              },
              orderBy: {
                added_at: 'asc'
              }
            }
          }
        },
        vetting_records: {
          select: {
            id: true,
            vetting_type: true,
            status: true,
            findings: true,
            recommendations: true,
            completed_at: true,
            vetter: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true
              }
            }
          },
          orderBy: {
            created_at: 'desc'
          }
        },
        audit_records: {
          select: {
            id: true,
            audit_type: true,
            status: true,
            findings: true,
            completed_at: true,
            auditor: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true
              }
            }
          },
          orderBy: {
            created_at: 'desc'
          }
        },
        fraud_alerts: {
          select: {
            id: true,
            alert_type: true,
            severity: true,
            description: true,
            status: true,
            created_at: true
          },
          orderBy: {
            created_at: 'desc'
          }
        }
      }
    })

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 })
    }

    // Resolve beneficiary (dependent) if applicable
    let beneficiary = null
    const beneficiaryId =
      claim.approval_codes?.find((code) => code.beneficiary_id)?.beneficiary_id ||
      claim.enrollee_id

    if (beneficiaryId) {
      const dependent = await prisma.dependent.findUnique({
        where: { dependent_id: beneficiaryId },
        select: {
          id: true,
          dependent_id: true,
          first_name: true,
          last_name: true,
          principal_id: true,
          relationship: true,
          preferred_provider_id: true
        }
      })

      if (dependent) {
        beneficiary = dependent
      }
    }

    // Calculate Enrollee Utilization
    let utilization = { amount_utilized: 0, balance: 0 }

    if (claim.principal) {
      // Use shared utility for consistent balance calculation
      utilization = await getEnrolleeUtilization(claim.principal.id)
    }

    // Fetch Linked Provider Request (Encounter)
    // Try to find request that produced this claim
    const providerRequest = await prisma.providerRequest.findFirst({
      where: {
        OR: [
          { claim_id: claim.id },
          { request_id: claim.claim_number } // Fallback linkage
        ]
      },
      select: {
        id: true,
        request_id: true,
        diagnosis: true,
        services: true,
        created_at: true,
        status: true
      }
    })

    // Fetch Plan Band
    let bandName = "N/A"
    if (claim.principal?.plan && claim.provider_id) {
      const planBand = await prisma.planBand.findFirst({
        where: {
          plan_id: claim.principal.plan.id,
          provider_id: claim.provider_id,
          status: 'ACTIVE'
        }
      })
      if (planBand) {
        bandName = planBand.band_type
      }
    }

    // Build encounter data using provider request as base and fill gaps from approval code.
    // This keeps diagnosis + clinical findings visible across all vetting pages.
    const firstApprovalCode = claim.approval_codes?.[0]
    let encounterData: any = null

    if (providerRequest || firstApprovalCode) {
      encounterData = {
        id: providerRequest?.id || firstApprovalCode?.id,
        request_id: providerRequest?.request_id || firstApprovalCode?.approval_code || null,
        diagnosis: providerRequest?.diagnosis || firstApprovalCode?.diagnosis || null,
        clinical_encounter:
          firstApprovalCode?.clinical_encounter || null,
        services: providerRequest?.services || firstApprovalCode?.services || null,
        created_at: providerRequest?.created_at || firstApprovalCode?.created_at || null,
        status: providerRequest?.status || 'APPROVED'
      }
    }

    // Calculate if it's the primary hospital
    let isPrimaryHospital = true
    if (claim.provider_id) {
      if (beneficiary && 'preferred_provider_id' in beneficiary && beneficiary.preferred_provider_id) {
        // For dependents, compare provider IDs
        isPrimaryHospital = claim.provider_id === beneficiary.preferred_provider_id
      } else if (claim.principal?.primary_hospital) {
        // For principals, compare facility name (since primary_hospital is a string name)
        isPrimaryHospital = claim.provider?.facility_name?.toLowerCase() === claim.principal.primary_hospital.toLowerCase()
      }
    }

    return NextResponse.json({
      claim: {
        ...claim,
        enrollee_utilization: utilization,
        encounter: encounterData,
        encounter_code: (encounterData as any)?.request_id || null,
        beneficiary,
        enrollee_band: bandName,
        is_primary_hospital: isPrimaryHospital
      }
    })
  } catch (error) {
    console.error("Error fetching claim:", error)
    return NextResponse.json(
      { error: "Failed to fetch claim" },
      { status: 500 }
    )
  }
}
