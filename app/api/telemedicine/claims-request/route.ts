import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has permission to view telemedicine claims
    const hasPermission = await checkPermission(session.user.role as any, "telemedicine", "view_claims")
    if (!hasPermission) {
      return NextResponse.json({ 
        error: "Insufficient permissions. You need 'view_claims' permission for telemedicine module." 
      }, { status: 403 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''

    const skip = (page - 1) * limit

    // Build where clause
    const whereClause: any = {
      claim_type: {
        in: ['TELEMEDICINE_LAB', 'TELEMEDICINE_RADIOLOGY', 'TELEMEDICINE_PHARMACY']
      }
    }

    // Add search filter
    if (search) {
      whereClause.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { enrollee_id: { contains: search, mode: "insensitive" } },
        { principal: {
          OR: [
            { enrollee_id: { contains: search, mode: "insensitive" } },
            { first_name: { contains: search, mode: "insensitive" } },
            { last_name: { contains: search, mode: "insensitive" } }
          ]
        }}
      ]
    }

    // Add status filter
    if (status) {
      whereClause.status = status
    }

    // Fetch telemedicine claims
    const claims = await prisma.claim.findMany({
      where: whereClause,
      select: {
        id: true,
        claim_number: true,
        claim_type: true,
        amount: true,
        status: true,
        description: true,
        created_at: true,
        enrollee_id: true,
        principal_id: true,
        lab_order_id: true,
        radiology_order_id: true,
        pharmacy_order_id: true,
        principal: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true,
            phone_number: true,
            email: true,
          }
        },
        provider: {
          select: {
            id: true,
            facility_name: true,
            facility_type: true,
          }
        }
      },
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    })

    // Fetch enrollee data for claims where principal is null
    const claimsWithEnrollee = await Promise.all(
      claims.map(async (claim) => {
        
        // If principal is null, try to fetch it using various methods
        if (!claim.principal) {
          let enrollee = null
          
          // First try using principal_id if it exists
          if (claim.principal_id) {
            try {
              enrollee = await prisma.principalAccount.findUnique({
                where: { id: claim.principal_id },
                select: {
                  id: true,
                  enrollee_id: true,
                  first_name: true,
                  last_name: true,
                  phone_number: true,
                  email: true,
                }
              })
              
              if (enrollee) {
              } else {
              }
            } catch (error) {
            }
          }
          
          // If not found, try to get enrollee from the order (lab/radiology/pharmacy)
          if (!enrollee) {
            try {
              if (claim.lab_order_id) {
                const labOrder = await prisma.labOrder.findUnique({
                  where: { id: claim.lab_order_id },
                  include: {
                    appointment: {
                      include: {
                        enrollee: true
                      }
                    }
                  }
                })
                
                if (labOrder) {
                  if (labOrder.appointment) {
                    if (labOrder.appointment.enrollee) {
                      enrollee = {
                        id: labOrder.appointment.enrollee.id,
                        enrollee_id: labOrder.appointment.enrollee.enrollee_id,
                        first_name: labOrder.appointment.enrollee.first_name,
                        last_name: labOrder.appointment.enrollee.last_name,
                        phone_number: labOrder.appointment.enrollee.phone_number || undefined,
                        email: labOrder.appointment.enrollee.email || undefined,
                      }
                    } else {
                    }
                  } else {
                  }
                } else {
                }
              } else if (claim.radiology_order_id) {
                const radiologyOrder = await prisma.radiologyOrder.findUnique({
                  where: { id: claim.radiology_order_id },
                  include: {
                    appointment: {
                      include: {
                        enrollee: true
                      }
                    }
                  }
                })
                
                if (radiologyOrder) {
                  if (radiologyOrder.appointment) {
                    if (radiologyOrder.appointment.enrollee) {
                      enrollee = {
                        id: radiologyOrder.appointment.enrollee.id,
                        enrollee_id: radiologyOrder.appointment.enrollee.enrollee_id,
                        first_name: radiologyOrder.appointment.enrollee.first_name,
                        last_name: radiologyOrder.appointment.enrollee.last_name,
                        phone_number: radiologyOrder.appointment.enrollee.phone_number || undefined,
                        email: radiologyOrder.appointment.enrollee.email || undefined,
                      }
                      } else {
                    }
                  } else {
                  }
                } else {
                }
              } else if (claim.pharmacy_order_id) {
                const pharmacyOrder = await prisma.pharmacyOrder.findUnique({
                  where: { id: claim.pharmacy_order_id },
                  include: {
                    appointment: {
                      include: {
                        enrollee: true
                      }
                    }
                  }
                })
                
                if (pharmacyOrder) {
                  if (pharmacyOrder.appointment) {
                    if (pharmacyOrder.appointment.enrollee) {
                      enrollee = {
                        id: pharmacyOrder.appointment.enrollee.id,
                        enrollee_id: pharmacyOrder.appointment.enrollee.enrollee_id,
                        first_name: pharmacyOrder.appointment.enrollee.first_name,
                        last_name: pharmacyOrder.appointment.enrollee.last_name,
                        phone_number: pharmacyOrder.appointment.enrollee.phone_number || undefined,
                        email: pharmacyOrder.appointment.enrollee.email || undefined,
                      }
                    } else {
                    }
                  } else {
                  }
                } else {
                }
              } else {
              }
            } catch (error) {
            }
          }
          
          // If still not found and enrollee_id exists, try using enrollee_id as ID (since it might be storing PrincipalAccount.id)
          if (!enrollee && claim.enrollee_id) {
            try {
              // First try treating enrollee_id as PrincipalAccount.id (CUID format)
              enrollee = await prisma.principalAccount.findUnique({
                where: { id: claim.enrollee_id },
                select: {
                  id: true,
                  enrollee_id: true,
                  first_name: true,
                  last_name: true,
                  phone_number: true,
                  email: true,
                }
              })
              
              if (enrollee) {
              } else {
                // If not found as ID, try as enrollee_id string
                enrollee = await prisma.principalAccount.findUnique({
                  where: { enrollee_id: claim.enrollee_id },
                  select: {
                    id: true,
                    enrollee_id: true,
                    first_name: true,
                    last_name: true,
                    phone_number: true,
                    email: true,
                  }
                })
                
                if (enrollee) {
                } else {
                }
              }
            } catch (error) {
            }
          }
          
          return {
            ...claim,
            enrollee: enrollee || null
          }
        }
        
        // Principal exists, so no need to fetch enrollee
        return {
          ...claim,
          enrollee: null
        }
      })
    )

    // Get total count
    const total = await prisma.claim.count({
      where: whereClause
    })

    // Get statistics
    const stats = await prisma.claim.groupBy({
      by: ['status'],
      where: {
        claim_type: {
          in: ['TELEMEDICINE_LAB', 'TELEMEDICINE_RADIOLOGY', 'TELEMEDICINE_PHARMACY']
        }
      },
      _count: {
        status: true
      }
    })

    return NextResponse.json({
      success: true,
      claims: claimsWithEnrollee,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      stats: stats.reduce((acc, stat) => {
        acc[stat.status] = stat._count.status
        return acc
      }, {} as Record<string, number>)
    })

  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch telemedicine claims" },
      { status: 500 }
    )
  }
}
