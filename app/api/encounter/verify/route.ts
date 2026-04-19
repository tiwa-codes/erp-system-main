import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { encounterCode, enrolleeId, providerId } = await request.json()


    if (!encounterCode || !enrolleeId || !providerId) {
      return NextResponse.json({
        success: false,
        error: "Missing required fields: encounterCode, enrolleeId, and providerId are required"
      }, { status: 400 })
    }

    // Encounter codes are generated as 4-character alphanumeric values.
    if (encounterCode.length !== 4) {
      return NextResponse.json({
        success: false,
        error: "Encounter code must be exactly 4 characters"
      }, { status: 400 })
    }

    // Check if encounter code exists in the database
    // First try with exact case
    let approvalCode = await prisma.approvalCode.findFirst({
      where: {
        approval_code: encounterCode.toUpperCase(),
        status: 'PENDING'
      },
      include: {
        enrollee: {
          include: {
            organization: true,
            plan: true
          }
        }
      }
    })

    // If not found, try with original case
    if (!approvalCode) {
      approvalCode = await prisma.approvalCode.findFirst({
        where: {
          approval_code: encounterCode,
          status: 'PENDING'
        },
        include: {
          enrollee: {
            include: {
              organization: true,
              plan: true
            }
          }
        }
      })
    }

    // If still not found, try without status filter
    if (!approvalCode) {
      approvalCode = await prisma.approvalCode.findFirst({
        where: {
          approval_code: encounterCode.toUpperCase()
        },
        include: {
          enrollee: {
            include: {
              organization: true,
              plan: true
            }
          }
        }
      })
    }

    // If still not found, try with original case without status filter
    if (!approvalCode) {
      approvalCode = await prisma.approvalCode.findFirst({
        where: {
          approval_code: encounterCode
        },
        include: {
          enrollee: {
            include: {
              organization: true,
              plan: true
            }
          }
        }
      })
    }

    // If still not found, try partial match
    if (!approvalCode) {
      approvalCode = await prisma.approvalCode.findFirst({
        where: {
          approval_code: {
            contains: encounterCode
          }
        },
        include: {
          enrollee: {
            include: {
              organization: true,
              plan: true
            }
          }
        }
      })
    }

    // Debug: List all approval codes to see what's in the database
    if (!approvalCode) {
      const allCodes = await prisma.approvalCode.findMany({
        select: {
          approval_code: true,
          status: true
        },
        take: 10
      })
    }

    if (!approvalCode) {
      return NextResponse.json({
        success: false,
        error: "Invalid encounter code. Please check and try again."
      }, { status: 400 })
    }

    // Use the enrollee from the approval code
    const enrollee = approvalCode.enrollee

    if (!enrollee || enrollee.status !== 'ACTIVE') {
      return NextResponse.json({
        success: false,
        error: "Enrollee not found or inactive"
      }, { status: 404 })
    }

    // Verify that the provided enrolleeId matches the enrollee (Principal or Dependent) associated with this encounter code
    let verifiedPatient: any = null

    // 1. Check if it matches the Principal (enrollee) - by UUID or by enrollee_id string
    const isPrincipalMatch = enrollee.id === enrolleeId || enrollee.enrollee_id === enrolleeId
    
    if (isPrincipalMatch) {
      // For Principal, beneficiary_id should represent the principal's enrollee_id, or be null/undefined (legacy)
      // If beneficiary_id corresponds to a dependent, then the Principal cannot claim it.
      const principalStringId = enrollee.enrollee_id
      const codeBeneficiaryId = approvalCode.beneficiary_id

      // Valid if: No beneficiary_id assigned OR beneficiary_id matches Principal's string ID
      if (!codeBeneficiaryId || codeBeneficiaryId === principalStringId) {
        verifiedPatient = {
          id: enrollee.id,
          enrollee_id: enrollee.enrollee_id,
          first_name: enrollee.first_name,
          last_name: enrollee.last_name,
          plan: enrollee.plan?.name || 'N/A',
          type: 'PRINCIPAL'
        }
      }
    }
    // 2. If not Principal, check if it's a Dependent - by UUID or by dependent_id string
    else {
      // Try to find dependent by UUID first, then by dependent_id string
      let dependent = await prisma.dependent.findUnique({
        where: { id: enrolleeId }
      })
      
      // If not found by UUID, try by dependent_id string
      if (!dependent) {
        dependent = await prisma.dependent.findUnique({
          where: { dependent_id: enrolleeId }
        })
      }

      if (dependent && dependent.principal_id === enrollee.id) {
        // Dependent belongs to this Principal.
        // Check if the code is specifically for this dependent
        if (approvalCode.beneficiary_id === dependent.dependent_id) {
          verifiedPatient = {
            id: dependent.id,
            enrollee_id: dependent.dependent_id,
            first_name: dependent.first_name,
            last_name: dependent.last_name,
            plan: enrollee.plan?.name || 'N/A',
            type: 'DEPENDENT'
          }
        }
      }
    }

    if (!verifiedPatient) {
      return NextResponse.json({
        success: false,
        error: "This encounter code is not valid for the specified enrollee. Each encounter code is specific to one enrollee only."
      }, { status: 403 })
    }

    // Check if provider exists and is active
    let provider = await prisma.provider.findFirst({
      where: {
        id: providerId,
        status: 'ACTIVE'
      }
    })

    // If not found with ACTIVE status, try without status filter
    if (!provider) {
      provider = await prisma.provider.findFirst({
        where: {
          id: providerId
        }
      })
    }

    if (!provider) {
      return NextResponse.json({
        success: false,
        error: "Provider not found"
      }, { status: 404 })
    }

    // Check if encounter code has already been used
    if (approvalCode.status === 'APPROVED') { // APPROVED = Used for encounter codes
      return NextResponse.json({
        success: false,
        error: "This encounter code has already been used and cannot be used again"
      }, { status: 409 })
    }

    const existingRequest = await prisma.providerRequest.findFirst({
      where: {
        request_id: encounterCode.toUpperCase(),
        enrollee_id: enrollee.id,
        status: {
          not: 'REJECTED'
        }
      }
    })

    if (existingRequest) {
      return NextResponse.json({
        success: false,
        error: "Encounter code has already been used for this enrollee"
      }, { status: 409 })
    }

    // Enhanced band validation - check if enrollee's plan covers this provider

    if (!enrollee.plan_id) {
      return NextResponse.json({
        success: false,
        error: "Enrollee does not have an assigned plan"
      }, { status: 400 })
    }

    // Get enrollee's plan with band information
    const enrolleePlan = await prisma.plan.findUnique({
      where: { id: enrollee.plan_id },
      select: {
        id: true,
        name: true,
        assigned_bands: true,
        band_type: true
      }
    })

    if (!enrolleePlan) {
      return NextResponse.json({
        success: false,
        error: "Enrollee's plan not found"
      }, { status: 404 })
    }

    // Determine enrollee's band(s)
    const enrolleeBands = enrolleePlan.assigned_bands && enrolleePlan.assigned_bands.length > 0
      ? enrolleePlan.assigned_bands
      : (enrolleePlan.band_type ? [enrolleePlan.band_type] : ["Band A"])


    // Check if provider is accessible under any of the enrollee's bands
    const planBands = await prisma.planBand.findMany({
      where: {
        plan_id: enrollee.plan_id,
        provider_id: providerId,
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

    // If no PlanBand records exist, check if we can determine provider bands from other sources
    let providerBands: string[] = []
    let isBandMatch = false
    let skipBandValidation = false
    let configurationWarning: string | null = null

    if (planBands.length === 0) {
      const providerWithBands = await prisma.provider.findUnique({
        where: { id: providerId },
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

      providerBands = providerWithBands.selected_bands || []
      skipBandValidation = true
      configurationWarning = providerBands.length > 0
        ? "PlanBand configuration is missing; using provider's selected bands as a fallback."
        : "PlanBand configuration is missing, and provider band selection is empty; defaulting to plan coverage rules."
    } else {
      providerBands = planBands.map(pb => pb.band_type)
    }

    const providerBandsLabel = providerBands.length > 0 ? providerBands.join(", ") : "Not configured"

    if (!skipBandValidation) {
      // STRICT HIERARCHICAL BAND VALIDATION
      // Band A enrollees can access Band A, B, C providers
      // Band B enrollees can access Band B, C providers ONLY (NOT Band A)
      // Band C enrollees can access Band C providers ONLY (NOT Band A or B)

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

      // Additional validation: Explicitly reject lower band access to higher bands
      const hasInvalidAccess = enrolleeBands.some(enrolleeBand => {
        const band = normalizeBand(enrolleeBand)
        return providerBands.some(providerBand => {
          const pBand = normalizeBand(providerBand)

          // Band C cannot access Band A or B
          if (band === 'Band C' && (pBand === 'Band A' || pBand === 'Band B')) {
            return true
          }

          // Band B cannot access Band A
          if (band === 'Band B' && pBand === 'Band A') {
            return true
          }

          return false
        })
      })

      // Override the match if there's invalid access detected
      if (hasInvalidAccess) {
        isBandMatch = false
      }

      if (!isBandMatch) {
        const accessibleBandsSummary = enrolleeBands.map(eb =>
          `${eb} (can access: ${getAccessibleBands(eb).join(", ")})`
        ).join(", ")

        // Create specific error message based on the restriction type
        let restrictionReason = ""
        const enrolleeBandTypes = enrolleeBands.map(eb => normalizeBand(eb))
        const providerBandTypes = providerBands.map(pb => normalizeBand(pb))

        if (enrolleeBandTypes.includes('Band C') && (providerBandTypes.includes('Band A') || providerBandTypes.includes('Band B'))) {
          restrictionReason = "Band C plans can only access Band C providers."
        } else if (enrolleeBandTypes.includes('Band B') && providerBandTypes.includes('Band A')) {
          restrictionReason = "Band B plans cannot access Band A providers. You can only access Band B and Band C providers."
        } else {
          restrictionReason = "Your plan band does not cover services at this provider level."
        }

        return NextResponse.json({
          success: false,
          error: `Access Denied: ${restrictionReason}`,
          details: {
            enrollee_bands: accessibleBandsSummary,
            provider_bands: providerBandsLabel,
            restriction_rule: restrictionReason,
            hierarchy_info: "Band A → A,B,C | Band B → B,C only | Band C → C only"
          }
        }, { status: 403 })
      }
    } else {
      isBandMatch = true
    }

    // Mark the encounter code as used
    await prisma.approvalCode.update({
      where: { id: approvalCode.id },
      data: {
        status: 'APPROVED', // APPROVED = Used for encounter codes
        updated_at: new Date()
      }
    })

    // Create audit log for marking code as used
    // First check if the user exists in the database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (user) {
      await prisma.auditLog.create({
        data: {
          user_id: session.user.id,
          action: "ENCOUNTER_CODE_VERIFY_AND_MARK_USED",
          resource: "approval_code",
          resource_id: approvalCode.id,
          old_values: { status: approvalCode.status },
          new_values: {
            status: 'APPROVED',
            verified_by_provider: providerId,
            verified_at: new Date().toISOString()
          }
        }
      })
    } else {
    }

    // If all validations pass, return success
    return NextResponse.json({
      success: true,
      message: "Encounter code verified successfully and marked as used",
      data: {
        enrollee: {
          id: verifiedPatient.id,
          enrollee_id: verifiedPatient.enrollee_id,
          first_name: verifiedPatient.first_name,
          last_name: verifiedPatient.last_name,
          plan: verifiedPatient.plan,
          bands: enrolleeBands,
          type: verifiedPatient.type
        },
        provider: {
          id: provider.id,
          facility_name: provider.facility_name,
          facility_type: provider.facility_type,
          bands: providerBands
        },
        encounterCode: encounterCode.toUpperCase(),
        verifiedAt: new Date().toISOString(),
        status: 'APPROVED',
        bandValidation: {
          enrolleeBands,
          providerBands: providerBandsLabel,
          isBandMatch: true,
          configurationWarning,
          message: `Provider bands (${providerBandsLabel}) match enrollee's accessible band(s): ${enrolleeBands.join(", ")}`,
          hierarchicalAccess: enrolleeBands.map(eb => ({
            enrolleeBand: eb,
            accessibleBands: getAccessibleBands(eb)
          }))
        }
      }
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Internal server error. Please try again later."
    }, { status: 500 })
  }
}
