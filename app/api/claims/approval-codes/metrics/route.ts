import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, 'claims', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get this week's date range
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())
    const endOfWeek = new Date(today)
    endOfWeek.setDate(today.getDate() + (6 - today.getDay()))

    // Get last week's date range for comparison
    const startOfLastWeek = new Date(startOfWeek)
    startOfLastWeek.setDate(startOfWeek.getDate() - 7)
    const endOfLastWeek = new Date(endOfWeek)
    endOfLastWeek.setDate(endOfWeek.getDate() - 7)

    const [
      allServices,
      approvedServices,
      rejectedServices,
      todaysServices,
      lastWeekAllServices,
      lastWeekApprovedServices
    ] = await Promise.all([
      // All services (total claims)
      prisma.claim.count(),
      
      // Approved services (processed approval codes)
      prisma.claim.count({
        where: { 
          status: 'APPROVED' 
        }
      }),
      
      // Rejected services
      prisma.claim.count({
        where: { 
          status: 'REJECTED' 
        }
      }),
      
      // Today's services
      prisma.claim.count({
        where: {
          submitted_at: {
            gte: today,
            lt: tomorrow
          }
        }
      }),
      
      // Last week all services for comparison
      prisma.claim.count({
        where: {
          submitted_at: {
            gte: startOfLastWeek,
            lt: endOfLastWeek
          }
        }
      }),
      
      // Last week approved services for comparison
      prisma.claim.count({
        where: {
          status: 'APPROVED',
          submitted_at: {
            gte: startOfLastWeek,
            lt: endOfLastWeek
          }
        }
      })
    ])

    // Calculate percentage changes
    const allServicesChange = lastWeekAllServices > 0 
      ? ((allServices - lastWeekAllServices) / lastWeekAllServices) * 100 
      : 0
    
    const approvedServicesChange = lastWeekApprovedServices > 0 
      ? ((approvedServices - lastWeekApprovedServices) / lastWeekApprovedServices) * 100 
      : 0

    const metrics = {
      all_services: allServices,
      approved_services: approvedServices,
      rejected_services: rejectedServices,
      todays_service: todaysServices,
      all_services_change: allServicesChange,
      approved_services_change: approvedServicesChange
    }

    return NextResponse.json({ metrics })
  } catch (error) {
    console.error('Error fetching approval code metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}
