import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user has audit permissions
    const hasAuditPermission = [
      'SUPER_ADMIN',
      'ADMIN', 
      'CLAIMS_MANAGER'
    ].includes(session.user.role)

    if (!hasAuditPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const provider = searchParams.get("provider") || ""

    const skip = (page - 1) * limit

    // Build where clause - Filter by current_stage = 'audit'
    const whereClause: any = {
      current_stage: 'audit'
    }

    if (search) {
      whereClause.OR = [
        { claim_number: { contains: search, mode: "insensitive" } },
        { enrollee_id: { contains: search, mode: "insensitive" } },
        { principal: { 
          OR: [
            { first_name: { contains: search, mode: "insensitive" } },
            { last_name: { contains: search, mode: "insensitive" } },
            { enrollee_id: { contains: search, mode: "insensitive" } }
          ]
        } },
        { provider: { facility_name: { contains: search, mode: "insensitive" } } }
      ]
    }

    if (provider && provider !== "all") {
      whereClause.provider_id = provider
    }

    if (status && status !== "all" && status !== "") {
      whereClause.status = status
    }

    // Get all claims for audit stage
    const allClaims = await prisma.claim.findMany({
      where: whereClause,
      select: {
        id: true,
        claim_number: true,
        status: true,
        amount: true,
        original_amount: true,
        approved_amount: true,
        submitted_at: true,
        processed_at: true,
        enrollee_id: true,
        provider_id: true,
        claim_type: true,
        current_stage: true,
        lab_order_id: true,
        radiology_order_id: true,
        pharmacy_order_id: true,
        principal: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            enrollee_id: true
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
      orderBy: { submitted_at: 'desc' }
    })

    // If a specific provider is requested, return individual claims
    if (provider && provider !== "all") {
      const formattedClaims = await Promise.all(allClaims.map(async (claim) => {
        let providerName = claim.provider?.facility_name || 'Unknown Provider'
        let facilityType = claim.provider?.facility_type || 'Unknown'
        
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
        
        return {
          id: claim.id,
          claim_number: claim.claim_number,
          enrollee_id: claim.enrollee_id,
          principal: claim.principal,
          provider: {
            id: claim.provider_id,
            facility_name: providerName,
            facility_type: facilityType
          },
          claim_type: claim.claim_type,
          amount: Number(claim.amount),
          original_amount: claim.original_amount ? Number(claim.original_amount) : null,
          approved_amount: claim.approved_amount ? Number(claim.approved_amount) : null,
          status: claim.status,
          submitted_at: claim.submitted_at,
          processed_at: claim.processed_at
        }
      }))

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

    // For overview, return individual claims
    const formattedClaims = await Promise.all(allClaims.map(async (claim) => {
      let providerName = claim.provider?.facility_name || 'Unknown Provider'
      
      if (!claim.provider_id && (claim.claim_type === 'TELEMEDICINE_LAB' || claim.claim_type === 'TELEMEDICINE_RADIOLOGY' || claim.claim_type === 'TELEMEDICINE_PHARMACY')) {
        const facilityName = await getTelemedicineFacilityName({
          lab_order_id: claim.lab_order_id || null,
          radiology_order_id: claim.radiology_order_id || null,
          pharmacy_order_id: claim.pharmacy_order_id || null,
          claim_type: claim.claim_type
        })
        providerName = facilityName || 'Telemedicine Facility'
      }
      
      return {
        id: claim.id,
        claim_number: claim.claim_number,
        enrollee_id: claim.enrollee_id,
        principal: claim.principal,
        provider: {
          id: claim.provider_id,
          facility_name: providerName,
          facility_type: claim.provider?.facility_type || []
        },
        claim_type: claim.claim_type,
        amount: Number(claim.amount),
        original_amount: claim.original_amount ? Number(claim.original_amount) : null,
        approved_amount: claim.approved_amount ? Number(claim.approved_amount) : null,
        status: claim.status,
        submitted_at: claim.submitted_at,
        processed_at: claim.processed_at
      }
    }))

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
    console.error("Error fetching audit claims:", error)
    return NextResponse.json(
      { error: "Failed to fetch claims" },
      { status: 500 }
    )
  }
}








