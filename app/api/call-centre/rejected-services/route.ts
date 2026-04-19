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

    // Check if user has call-centre permissions
    const hasPermission = await checkPermission(session.user.role as any, "call-centre", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""

    // Build where clause using the same base workflow states as provider requests.
    const where: any = {
      status: { in: ['REJECTED', 'PARTIAL'] }
    }
    
    if (search) {
      where.AND = where.AND || []
      where.AND.push({
        OR: [
          { provider: { facility_name: { contains: search, mode: "insensitive" } } },
          { hospital: { contains: search, mode: "insensitive" } },
          { services: { contains: search, mode: "insensitive" } },
          { enrollee: { 
            OR: [
              { enrollee_id: { contains: search, mode: "insensitive" } },
              { first_name: { contains: search, mode: "insensitive" } },
              { last_name: { contains: search, mode: "insensitive" } }
            ]
          }},
        ]
      })
    }

    // Fetch ALL requests (not paginated yet) to properly filter by rejected services
    const rejectedRequests = await prisma.providerRequest.findMany({
      where,
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
    })

    // Format rejected requests with parsed services
    const formattedRejectedRequests = rejectedRequests.map(request => {
      // Parse services to find rejected services
      let rejectedServices = []
      let allServices = []
      let rejectionDetails = null
      
      // Try to parse rejection_reason as JSON (new format)
      try {
        if (request.rejection_reason && request.rejection_reason.startsWith('{')) {
          rejectionDetails = JSON.parse(request.rejection_reason)
          if (rejectionDetails.rejected_services) {
            rejectedServices = rejectionDetails.rejected_services
          }
        }
      } catch (error) {
        // Ignore JSON parse failure for legacy rows.
      }
      
      // Parse services array
      try {
        const parsedServices = JSON.parse(request.services || '[]')
        if (Array.isArray(parsedServices)) {
          allServices = parsedServices
          
          // If we don't have rejected services from rejection_reason, get from services array
          if (rejectedServices.length === 0) {
            rejectedServices = parsedServices.filter((service: any) => 
              service.coverage === 'REJECTED' || service.coverage === 'NOT_COVERED'
            )
            
            // If status is REJECTED but no services marked as rejected, include all services
            if (rejectedServices.length === 0 && request.status === 'REJECTED') {
              rejectedServices = parsedServices
            }
          }
        }
      } catch (error) {
        // If parsing fails, show the raw services text
        allServices = [{ service_name: 'Unknown Service', amount: 0 }]
      }

      return {
        id: request.id,
        request_id: `REQ-${request.id.slice(-8).toUpperCase()}`,
        enrollee_name: `${request.enrollee?.first_name || ''} ${request.enrollee?.last_name || ''}`.trim(),
        enrollee_id: request.enrollee?.enrollee_id || '',
        provider_name: request.provider.facility_name,
        hospital_name: request.hospital,
        services: request.services,
        rejected_services: rejectedServices,
        all_services: allServices,
        amount: request.amount,
        rejected_amount: rejectedServices.reduce((sum: number, service: any) => sum + (service.amount || 0), 0),
        rejection_reason: (() => {
          // First check if we have rejection details from new JSON format
          if (rejectionDetails) {
            return rejectionDetails.overall_remarks || 
                   rejectionDetails.rejected_services?.map((s: any) => s.rejection_reason).filter(Boolean).join('; ') ||
                   'Services not covered by plan'
          }
          
          // Get rejection reason from individual services (old format)
          if (rejectedServices.length > 0) {
            const reasons = rejectedServices
              .map((service: any) => service.remarks || service.rejection_reason)
              .filter((reason: string) => reason && reason.trim() !== '')
            
            if (reasons.length > 0) {
              return reasons.join('; ')
            }
          }
          
          // Fallback to request-level rejection reason (if not JSON)
          return request.rejection_reason || 'No reason provided'
        })(),
        status: request.status,
        date: request.created_at,
        rejected_at: request.updated_at, // When it was rejected (updated)
        provider: request.provider,
        enrollee: request.enrollee
      }
    })

    // Keep all REJECTED requests to match provider-request rejected totals,
    // and include PARTIAL requests when they contain rejected service items.
    const requestsWithRejectedServices = formattedRejectedRequests.filter((request) =>
      request.status === 'REJECTED' || request.rejected_services.length > 0
    )

    // Apply pagination AFTER filtering
    const skip = (page - 1) * limit
    const paginatedResults = requestsWithRejectedServices.slice(skip, skip + limit)

    return NextResponse.json({
      success: true,
      rejected_requests: paginatedResults,
      pagination: {
        page,
        limit,
        total: requestsWithRejectedServices.length,
        pages: Math.ceil(requestsWithRejectedServices.length / limit)
      }
    })

  } catch (error) {
    console.error('❌ [REJECTED SERVICES] Error:', error)
    return NextResponse.json(
      { error: "Failed to fetch rejected services" },
      { status: 500 }
    )
  }
}