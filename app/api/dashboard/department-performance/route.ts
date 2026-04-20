import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get department performance data for today
    const departmentPerformance = []

    // Claims Department Performance
    const claimsVetted = await prisma.claim.count({
      where: {
        processed_at: {
          gte: today,
          lt: tomorrow
        },
        status: 'APPROVED'
      }
    })

    const totalClaims = await prisma.claim.count({
      where: {
        submitted_at: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    const claimsPercentage = totalClaims > 0 ? Math.round((claimsVetted / totalClaims) * 100) : 0

    departmentPerformance.push({
      name: 'Claims',
      description: `${claimsVetted} Claims Vetted`,
      percentage: claimsPercentage,
      color: 'bg-green-500'
    })

    // Provider Management Performance
    const providerFollowups = await prisma.providerRequest.count({
      where: {
        created_at: {
          gte: today,
          lt: tomorrow
        },
        status: 'APPROVED'
      }
    })

    const totalProviderRequests = await prisma.providerRequest.count({
      where: {
        created_at: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    const providerPercentage = totalProviderRequests > 0 ? Math.round((providerFollowups / totalProviderRequests) * 100) : 0

    departmentPerformance.push({
      name: 'Provider Management',
      description: `${providerFollowups} Case Management Follow-up`,
      percentage: providerPercentage,
      color: 'bg-orange-500'
    })

    // Call Centre Performance
    const approvalCodesGenerated = await prisma.approvalCode.count({
      where: {
        created_at: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    const callCentrePercentage = Math.min(approvalCodesGenerated * 3, 100) // Scale based on codes generated

    departmentPerformance.push({
      name: 'Call Centre',
      description: `${approvalCodesGenerated} Approval Code Generated`,
      percentage: callCentrePercentage,
      color: 'bg-[#0891B2]'
    })

    // HR Department Performance
    const employeesAdded = await prisma.employee.count({
      where: {
        created_at: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    const hrPercentage = Math.min(employeesAdded * 10, 100) // Scale based on employees added

    departmentPerformance.push({
      name: 'Human Resources',
      description: `${employeesAdded} New Employees Added`,
      percentage: hrPercentage,
      color: 'bg-purple-500'
    })

    // Always return real data, even if it's zero
    // No fallback mock data - show actual performance metrics

    return NextResponse.json({
      success: true,
      departments: departmentPerformance
    })

  } catch (error) {
    console.error("Error fetching department performance:", error)
    return NextResponse.json(
      { error: "Failed to fetch department performance" },
      { status: 500 }
    )
  }
}
