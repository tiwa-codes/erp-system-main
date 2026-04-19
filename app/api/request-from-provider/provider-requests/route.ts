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

    // Check if user has request-from-provider permissions
    const hasPermission = await checkPermission(session.user.role as any, "request-from-provider", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const rawSearch = searchParams.get("search") || ""
    const search = rawSearch.trim()

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.OR = [
        { provider_name: { startsWith: search, mode: "insensitive" } },
        { hospital_name: { startsWith: search, mode: "insensitive" } },
        { services: { contains: search, mode: "insensitive" } },
        { beneficiary_name: { startsWith: search, mode: "insensitive" } },
        { beneficiary_id: { startsWith: search, mode: "insensitive" } },
      ]
    }

    const [providerRequests, total] = await Promise.all([
      prisma.providerRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
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
      }),
      prisma.providerRequest.count({ where })
    ])

    // Get approval codes for approved requests
    const approvedRequestIds = providerRequests
      .filter(req => req.status === 'APPROVED')
      .map(req => req.id)

    const approvalCodes = approvedRequestIds.length > 0 
      ? await prisma.approvalCode.findMany({
          where: {
            enrollee_id: { in: providerRequests.map(req => req.enrollee_id) },
            hospital: { in: providerRequests.map(req => req.hospital) }
          },
          select: {
            id: true,
            approval_code: true,
            enrollee_id: true,
            hospital: true,
            created_at: true
          }
        })
      : []

    // Format provider requests
    const formattedRequests = providerRequests.map(request => {
      // Find matching approval code
      const matchingApprovalCode = approvalCodes.find(code => 
        code.enrollee_id === request.enrollee_id && 
        code.hospital === request.hospital &&
        new Date(code.created_at) >= new Date(request.created_at)
      )

      const beneficiaryName = request.beneficiary_name || `${request.enrollee?.first_name || ''} ${request.enrollee?.last_name || ''}`.trim()
      const beneficiaryId = request.beneficiary_id || request.enrollee?.enrollee_id || ''
      const isDependent = !!request.beneficiary_id && request.beneficiary_id !== request.enrollee?.enrollee_id

      return {
        id: request.id,
        request_id: `REQ-${request.id.slice(-8).toUpperCase()}`,
        provider_name: request.provider.facility_name,
        hospital_name: request.hospital,
        services: request.services,
        amount: request.amount,
        beneficiary_id: beneficiaryId,
        beneficiary_name: beneficiaryName,
        is_dependent: isDependent,
        status: request.status,
        date: request.created_at,
        approval_code: matchingApprovalCode?.approval_code || (request.status === 'REJECTED' ? 'Rejected' : null),
        provider: request.provider,
        enrollee: request.enrollee
      }
    })

    return NextResponse.json({
      success: true,
      provider_requests: formattedRequests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error("Error fetching provider requests:", error)
    return NextResponse.json(
      { error: "Failed to fetch provider requests" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has call-centre permissions
    const hasPermission = await checkPermission(session.user.role as any, "request-from-provider", "add")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const {
      provider_id,
      enrollee_id,
      hospital,
      services,
      amount,
      diagnosis
    } = body

    if (!provider_id || !enrollee_id || !hospital || !services) {
      return NextResponse.json({ error: "Provider ID, enrollee ID, hospital, and services are required" }, { status: 400 })
    }

    let principalId: string | null = null
    let beneficiaryId: string | null = null
    let beneficiaryName: string | null = null

    // Try to resolve principal by enrollee_id (string) or id (UUID)
    const principal = await prisma.principalAccount.findFirst({
      where: {
        OR: [
          { id: enrollee_id },
          { enrollee_id: enrollee_id }
        ]
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        enrollee_id: true
      }
    })

    if (principal) {
      principalId = principal.id
      beneficiaryId = principal.enrollee_id
      beneficiaryName = `${principal.first_name} ${principal.last_name}`
    } else {
      const dependent = await prisma.dependent.findFirst({
        where: {
          OR: [
            { id: enrollee_id },
            { dependent_id: enrollee_id }
          ]
        },
        include: {
          principal: {
            select: {
              id: true,
              enrollee_id: true,
              first_name: true,
              last_name: true
            }
          }
        }
      })

      if (dependent && dependent.principal) {
        principalId = dependent.principal_id
        beneficiaryId = dependent.dependent_id
        beneficiaryName = `${dependent.first_name} ${dependent.last_name}`
      }
    }

    if (!principalId) {
      return NextResponse.json({ error: "Enrollee not found (checked principal and dependent)" }, { status: 404 })
    }

    const serializedServices = Array.isArray(services) ? JSON.stringify(services) : services

    const providerRequest = await prisma.providerRequest.create({
      data: {
        provider_id,
        enrollee_id: principalId,
        hospital,
        services: serializedServices,
        amount: parseFloat(amount) || 0,
        diagnosis: diagnosis || '',
        status: 'PENDING',
        beneficiary_id: beneficiaryId,
        beneficiary_name: beneficiaryName
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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "PROVIDER_REQUEST_CREATE",
        resource: "provider_request",
        resource_id: providerRequest.id,
        new_values: providerRequest
      }
    })

    return NextResponse.json({
      success: true,
      provider_request: {
        id: providerRequest.id,
        request_id: `REQ-${providerRequest.id.slice(-8).toUpperCase()}`,
        provider_name: providerRequest.provider.facility_name,
        hospital_name: providerRequest.hospital,
        services: providerRequest.services,
        amount: providerRequest.amount,
        status: providerRequest.status,
        date: providerRequest.created_at
      }
    }, { status: 201 })

  } catch (error) {
    console.error("Error creating provider request:", error)
    return NextResponse.json(
      { error: "Failed to create provider request" },
      { status: 500 }
    )
  }
}
