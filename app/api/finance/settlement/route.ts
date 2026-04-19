import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
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
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canAccess = await checkPermission(session.user.role as any, 'finance', 'view')
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const skip = (page - 1) * limit

    // Build where clause for approved claims
    const whereClause: any = {
      status: 'APPROVED'
    }

    if (status && status !== 'all') {
      if (status === 'PENDING') {
        whereClause.payouts = {
          none: {}
        }
      } else if (status === 'PAID') {
        whereClause.payouts = {
          some: {
            status: 'PROCESSED'
          }
        }
      } else if (status === 'PROCESSING') {
        whereClause.payouts = {
          some: {
            status: 'PENDING'
          }
        }
      }
    }

    if (startDate && endDate) {
      whereClause.submitted_at = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    // Get approved claims for settlement
    const claims = await prisma.claim.findMany({
      where: whereClause,
      select: {
        id: true,
        claim_number: true,
        amount: true,
        status: true,
        submitted_at: true,
        created_at: true,
        provider_id: true,
        claim_type: true,
        lab_order_id: true,
        radiology_order_id: true,
        pharmacy_order_id: true,
        principal: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true
          }
        },
        provider: {
          select: {
            id: true,
            facility_name: true,
            hcp_code: true
          }
        },
        payouts: {
          select: {
            status: true,
            amount: true,
            created_at: true
          }
        }
      },
      orderBy: {
        submitted_at: 'desc'
      },
      skip,
      take: limit
    })

    // Get total count
    const total = await prisma.claim.count({
      where: whereClause
    })

    const mappedClaims = await Promise.all(claims.map(async (claim) => {
      const hasPayout = claim.payouts.length > 0
      const payoutStatus = hasPayout ? claim.payouts[0].status : 'PENDING'
      
      // Get facility name - handle telemedicine claims
      let providerName = claim.provider?.facility_name || 'Unknown Provider'
      let providerCode = claim.provider?.hcp_code || ''
      
      if (!claim.provider_id && (claim.claim_type === 'TELEMEDICINE_LAB' || claim.claim_type === 'TELEMEDICINE_RADIOLOGY' || claim.claim_type === 'TELEMEDICINE_PHARMACY')) {
        const facilityName = await getTelemedicineFacilityName({
          lab_order_id: claim.lab_order_id || null,
          radiology_order_id: claim.radiology_order_id || null,
          pharmacy_order_id: claim.pharmacy_order_id || null,
          claim_type: claim.claim_type
        })
        if (facilityName) {
          providerName = facilityName
        } else {
          providerName = 'Telemedicine Facility'
        }
      }
      
      return {
        id: claim.id,
        claim_id: claim.id,
        enrollee_name: claim.principal ? `${claim.principal.first_name} ${claim.principal.last_name}` : 'Unknown',
        provider_name: providerName,
        amount: claim.amount,
        status: payoutStatus === 'PAID' ? 'PAID' : payoutStatus === 'PROCESSED' ? 'PROCESSING' : 'PENDING',
        approved_at: claim.submitted_at.toISOString(),
        created_at: claim.created_at.toISOString(),
        claim: {
          id: claim.id,
          claim_number: claim.claim_number,
          amount: claim.amount,
          status: claim.status
        },
        principal: claim.principal || {
          id: '',
          enrollee_id: '',
          first_name: 'Unknown',
          last_name: 'Enrollee'
        },
        provider: {
          id: claim.provider?.id || '',
          name: providerName,
          provider_code: providerCode
        }
      }
    }))

    const pagination = {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }

    return NextResponse.json({ 
      claims: mappedClaims,
      pagination 
    })
  } catch (error) {
    console.error('Error fetching settlement claims:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settlement claims' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canAccess = await checkPermission(session.user.role as any, 'finance', 'edit')
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { claim_id, payout_method, payout_reference } = body

    // Create payout record
    const payout = await prisma.payout.create({
      data: {
        claim_id,
        amount: 0, // Will be updated with actual claim amount
        payout_method: payout_method || 'BANK_TRANSFER',
        payout_reference: payout_reference || '',
        status: 'PENDING'
      }
    })

    // Update payout amount with claim amount
    const claim = await prisma.claim.findUnique({
      where: { id: claim_id },
      select: { amount: true }
    })

    if (claim) {
      await prisma.payout.update({
        where: { id: payout.id },
        data: { amount: claim.amount }
      })
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'CLAIM_PAYOUT',
        resource: 'Claim',
        resource_id: claim_id,
        new_values: { 
          payout_id: payout.id,
          payout_method,
          payout_reference,
          status: 'PENDING'
        },
        created_at: new Date()
      }
    })

    return NextResponse.json({ payout })
  } catch (error) {
    console.error('Error processing payout:', error)
    return NextResponse.json(
      { error: 'Failed to process payout' },
      { status: 500 }
    )
  }
}
