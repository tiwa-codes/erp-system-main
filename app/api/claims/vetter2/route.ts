import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildClaimSearchOrClauses } from "@/lib/claims-search"
import { checkPermission } from "@/lib/permissions"

// Helper function to get facility name from telemedicine order
async function getTelemedicineFacilityName(claim: {
  lab_order_id: string | null
  radiology_order_id: string | null
  pharmacy_order_id: string | null
  claim_type: string
}): Promise<string | null> {
  try {
    if (claim.lab_order_id) {
      const labOrder = await prisma.labOrder.findUnique({
        where: { id: claim.lab_order_id },
        select: {
          facility: {
            select: {
              facility_name: true
            }
          }
        }
      })
      return labOrder?.facility?.facility_name || null
    }

    if (claim.radiology_order_id) {
      const radiologyOrder = await prisma.radiologyOrder.findUnique({
        where: { id: claim.radiology_order_id },
        select: {
          facility: {
            select: {
              facility_name: true
            }
          }
        }
      })
      return radiologyOrder?.facility?.facility_name || null
    }

    if (claim.pharmacy_order_id) {
      const pharmacyOrder = await prisma.pharmacyOrder.findUnique({
        where: { id: claim.pharmacy_order_id },
        select: {
          facility: {
            select: {
              facility_name: true
            }
          }
        }
      })
      return pharmacyOrder?.facility?.facility_name || null
    }

    return null
  } catch (error) {
    console.error('Error fetching telemedicine facility name:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [canViewClaims, canVetClaims] = await Promise.all([
      checkPermission(session.user.role as any, "claims", "view"),
      checkPermission(session.user.role as any, "claims", "vet")
    ])

    if (!canViewClaims && !canVetClaims) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const provider = searchParams.get("provider") || ""
    const billType = searchParams.get("bill_type") || ""

    const skip = (page - 1) * limit

    // Build where clause - Get all providers and their claim statistics
    const whereClause: any = {}

    if (search) {
      whereClause.OR = await buildClaimSearchOrClauses(search)
    }

    if (provider && provider !== "all") {
      whereClause.provider_id = provider
    }

    // Filter by current_stage = 'vetter2'
    whereClause.current_stage = 'vetter2'

    if (billType === 'manual') {
      whereClause.approval_codes = { some: { is_manual: true, is_deleted: false } }
    } else if (billType === 'auto') {
      whereClause.NOT = { approval_codes: { some: { is_manual: true, is_deleted: false } } }
    }

    // Add status filter for detail pages
    if (status && status !== "all" && status !== "") {
      whereClause.status = status
    } else if (!status || status === "all" || status === "") {
      // Default to showing PENDING and other vetting-related statuses
      whereClause.status = {
        in: ["PENDING", "SUBMITTED", "UNDER_REVIEW", "VETTING", "VETTER1_COMPLETED"]
      }
    }

    // Get all claims that have been vetted by vetter1 (for vetter2)
    const allClaims = await prisma.claim.findMany({
      where: {
        ...whereClause
      },
      select: {
        id: true,
        claim_number: true,
        status: true,
        amount: true,
        submitted_at: true,
        processed_at: true,
        enrollee_id: true,
        provider_id: true,
        claim_type: true,
        lab_order_id: true,
        radiology_order_id: true,
        pharmacy_order_id: true,
        principal: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            enrollee_id: true,
            primary_hospital: true
          }
        },
        provider: {
          select: {
            id: true,
            facility_name: true,
            facility_type: true
          }
        }
      },
      orderBy: { submitted_at: 'desc' } // New claims first
    })

    if (search && allClaims.length === 0) {
      // Let's also check what claims exist in the database
      const sampleClaims = await prisma.claim.findMany({
        take: 5,
        select: {
          id: true,
          claim_number: true,
          enrollee_id: true,
          status: true,
          principal: {
            select: {
              enrollee_id: true,
              first_name: true,
              last_name: true
            }
          }
        }
      })
    }

    // If a specific provider is requested, return individual claims for that provider
    if (provider && provider !== "all") {
      // Re-fetch claims with status filter applied
      const filteredClaims = await prisma.claim.findMany({
        where: {
          ...whereClause,
          ...(status && status !== "all" && status !== "" ? { status } : {})
        },
        select: {
          id: true,
          claim_number: true,
          status: true,
          amount: true,
          submitted_at: true,
          processed_at: true,
          enrollee_id: true,
          provider_id: true,
          claim_type: true,
          lab_order_id: true,
          radiology_order_id: true,
          pharmacy_order_id: true,
          principal: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              enrollee_id: true,
              primary_hospital: true
            }
          },
          provider: {
            select: {
              id: true,
              facility_name: true,
              facility_type: true
            }
          },
          vetting_records: {
            select: {
              id: true,
              findings: true,
              recommendations: true,
              status: true,
              completed_at: true,
              vetter: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true
                }
              }
            },
            orderBy: {
              completed_at: 'desc'
            }
          }
        },
        orderBy: { submitted_at: 'desc' } // New claims first
      })

      // Batch-fetch dependent names for claims where enrollee is a dependent
      const dependentEnrolleeIds1 = filteredClaims
        .filter(c => c.enrollee_id && c.enrollee_id !== c.principal?.enrollee_id)
        .map(c => c.enrollee_id as string)
      const dependentMap1: Record<string, { first_name: string; last_name: string }> = {}
      if (dependentEnrolleeIds1.length > 0) {
        const deps = await prisma.dependent.findMany({
          where: { dependent_id: { in: dependentEnrolleeIds1 } },
          select: { dependent_id: true, first_name: true, last_name: true, preferred_provider_id: true }
        })
        deps.forEach(d => { dependentMap1[d.dependent_id] = d })
      }

      // Batch-fetch provider requests to get encounter codes (request_id)
      const claimIds = filteredClaims.map(c => c.id)
      const providerRequests = await prisma.providerRequest.findMany({
        where: {
          OR: [
            { claim_id: { in: claimIds } },
            { request_id: { in: filteredClaims.map(c => c.claim_number) } }
          ]
        },
        select: {
          claim_id: true,
          request_id: true
        }
      })

      const encounterCodeMap: Record<string, string> = {}
      providerRequests.forEach(pr => {
        if (pr.claim_id) {
          encounterCodeMap[pr.claim_id] = pr.request_id
        }
        // Also map by request_id if it matches claim_number as a fallback
        encounterCodeMap[pr.request_id] = pr.request_id
      })

      const formattedClaims = await Promise.all(filteredClaims.map(async (claim) => {
        let providerName = claim.provider?.facility_name || 'Unknown Provider'
        let facilityType = claim.provider?.facility_type || 'Unknown'

        // Handle telemedicine claims - fetch actual facility name from order
        if (!claim.provider_id && (claim.claim_type === 'TELEMEDICINE_LAB' || claim.claim_type === 'TELEMEDICINE_RADIOLOGY' || claim.claim_type === 'TELEMEDICINE_PHARMACY')) {
          const facilityName = await getTelemedicineFacilityName({
            lab_order_id: claim.lab_order_id || null,
            radiology_order_id: claim.radiology_order_id || null,
            pharmacy_order_id: claim.pharmacy_order_id || null,
            claim_type: claim.claim_type
          })
          if (facilityName) {
            providerName = facilityName
            facilityType = 'Telemedicine'
          } else {
            providerName = 'Telemedicine Facility'
            facilityType = 'Telemedicine'
          }
        }

        const dep1 = dependentMap1[claim.enrollee_id]
        const isDependent1 = !!dep1
        let isPrimaryHospital1 = true
        if (claim.provider_id) {
          if (isDependent1 && (dep1 as any).preferred_provider_id) {
            isPrimaryHospital1 = claim.provider_id === (dep1 as any).preferred_provider_id
          } else if (claim.principal?.primary_hospital) {
            isPrimaryHospital1 = claim.provider?.facility_name?.toLowerCase() === claim.principal.primary_hospital.toLowerCase()
          }
        }
        return {
          id: claim.id,
          claim_number: claim.claim_number,
          encounter_code: encounterCodeMap[claim.id] || encounterCodeMap[claim.claim_number] || null,
          enrollee_name: dep1
            ? `${dep1.first_name} ${dep1.last_name}`
            : (claim.principal ? `${claim.principal.first_name} ${claim.principal.last_name}` : 'Unknown Enrollee'),
          enrollee_id: claim.enrollee_id,
          provider_name: providerName,
          facility_type: facilityType,
          status: claim.status,
          amount: claim.amount,
          submitted_at: claim.submitted_at,
          processed_at: claim.processed_at,
          provider_id: claim.provider_id,
          is_primary_hospital: isPrimaryHospital1,
          vetting_records: claim.vetting_records
        }
      }))

      // Apply pagination to individual claims
      const total = formattedClaims.length
      const pages = Math.ceil(total / limit)
      const paginatedClaims = formattedClaims.slice(skip, skip + limit)

      return NextResponse.json({
        success: true,
        claims: paginatedClaims,
        pagination: {
          page,
          limit,
          total,
          pages
        }
      })
    }

    // Fetch facility names for all telemedicine claims
    const claimsWithFacilityNames = await Promise.all(
      allClaims.map(async (claim) => {
        let facilityName = claim.provider?.facility_name || null

        // Fetch facility name from telemedicine order if needed
        if (!claim.provider_id && (claim.claim_type === 'TELEMEDICINE_LAB' || claim.claim_type === 'TELEMEDICINE_RADIOLOGY' || claim.claim_type === 'TELEMEDICINE_PHARMACY')) {
          const telemedicineFacilityName = await getTelemedicineFacilityName({
            lab_order_id: claim.lab_order_id || null,
            radiology_order_id: claim.radiology_order_id || null,
            pharmacy_order_id: claim.pharmacy_order_id || null,
            claim_type: claim.claim_type
          })
          facilityName = telemedicineFacilityName || 'Telemedicine Facility'
        }

        return {
          ...claim,
          facility_name: facilityName || 'Unknown Provider'
        }
      })
    )

    // Group claims by provider and calculate statistics
    // Batch-fetch dependent names for claims where enrollee is a dependent (overview path)
    const dependentEnrolleeIds2 = claimsWithFacilityNames
      .filter(c => c.enrollee_id && c.enrollee_id !== c.principal?.enrollee_id)
      .map(c => c.enrollee_id as string)
    const dependentMap2: Record<string, { first_name: string; last_name: string }> = {}
    if (dependentEnrolleeIds2.length > 0) {
      const deps = await prisma.dependent.findMany({
        where: { dependent_id: { in: dependentEnrolleeIds2 } },
        select: { dependent_id: true, first_name: true, last_name: true }
      })
      deps.forEach(d => { dependentMap2[d.dependent_id] = d })
    }

    const providerStats = claimsWithFacilityNames.reduce((acc: any, claim) => {
      let providerId = claim.provider_id
      let providerName = claim.facility_name || 'Unknown Provider'
      let facilityType = claim.provider?.facility_type || 'Unknown'

      // Handle telemedicine claims - use facility name as grouping key
      if (!claim.provider_id && (claim.claim_type === 'TELEMEDICINE_LAB' || claim.claim_type === 'TELEMEDICINE_RADIOLOGY' || claim.claim_type === 'TELEMEDICINE_PHARMACY')) {
        // Group by facility name for telemedicine claims
        providerId = `telemedicine_${claim.facility_name || 'unknown'}`
        facilityType = 'Telemedicine'
      }

      if (!acc[providerId]) {
        acc[providerId] = {
          id: providerId,
          provider_name: providerName,
          facility_type: facilityType,
          total_claims: 0,
          pending_vetting: 0,
          vetted: 0,
          rejected: 0,
          total_amount: 0,
          latest_claim: null
        }
      }

      const stats = acc[providerId]
      stats.total_claims++
      stats.total_amount += Number(claim.amount || 0)

      // Count by status
      if (claim.status === 'VETTER1_COMPLETED') {
        stats.pending_vetting++
      } else if (claim.status === 'VETTER2_COMPLETED' || claim.status === 'AUDIT_COMPLETED' ||
        claim.status === 'APPROVED') {
        stats.vetted++
      } else if (claim.status === 'REJECTED') {
        stats.rejected++
      }

      // Keep track of latest claim
      if (!stats.latest_claim || new Date(claim.submitted_at) > new Date(stats.latest_claim.submitted_at)) {
        const dep2 = dependentMap2[claim.enrollee_id]
        const isDependent2 = !!dep2
        let isPrimaryHospital2 = true
        if (claim.provider_id) {
          if (isDependent2 && (dep2 as any).preferred_provider_id) {
            isPrimaryHospital2 = claim.provider_id === (dep2 as any).preferred_provider_id
          } else if (claim.principal?.primary_hospital) {
            isPrimaryHospital2 = (claim as any).facility_name?.toLowerCase() === claim.principal.primary_hospital.toLowerCase()
          }
        }
        stats.latest_claim = {
          id: claim.id,
          claim_number: claim.claim_number,
          enrollee_name: dep2
            ? `${dep2.first_name} ${dep2.last_name}`
            : (claim.principal ? `${claim.principal.first_name} ${claim.principal.last_name}` : 'Unknown Enrollee'),
          enrollee_id: claim.enrollee_id,
          provider_name: providerName,
          status: claim.status,
          amount: claim.amount,
          submitted_at: claim.submitted_at,
          provider_id: claim.provider_id,
          is_primary_hospital: isPrimaryHospital2
        }
      }

      return acc
    }, {})

    // Convert to array and sort by latest claim date
    const formattedClaims = Object.values(providerStats).sort((a: any, b: any) =>
      new Date(b.latest_claim?.submitted_at || 0).getTime() -
      new Date(a.latest_claim?.submitted_at || 0).getTime()
    )

    // Apply pagination directly to formatted claims
    const total = formattedClaims.length
    const pages = Math.ceil(total / limit)
    const paginatedClaims = formattedClaims.slice(skip, skip + limit)

    return NextResponse.json({
      success: true,
      claims: paginatedClaims,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    })

  } catch (error) {
    console.error("Error fetching vetter2 claims:", error)
    return NextResponse.json(
      { error: "Failed to fetch claims" },
      { status: 500 }
    )
  }
}
