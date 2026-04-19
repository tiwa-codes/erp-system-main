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

    // Check if user has reports permissions
    const hasPermission = await checkPermission(session.user.role as any, "reports", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const category = searchParams.get("category")
    const department = searchParams.get("department")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    if (category && category !== "all") {
      where.category = category
    }

    // Build date filter for claims
    const dateFilter: any = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate)
    }

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          principal_accounts: {
            include: {
              claims: {
                where: Object.keys(dateFilter).length > 0 ? { created_at: dateFilter } : {},
                select: {
                  id: true,
                  amount: true,
                  status: true
                }
              },
              _count: {
                select: {
                  claims: Object.keys(dateFilter).length > 0 ? {
                    where: { created_at: dateFilter }
                  } : true
                }
              }
            }
          },
          _count: {
            select: {
              principal_accounts: true
            }
          }
        }
      }),
      prisma.organization.count({ where })
    ])

    // Format organizations with performance data
    const formattedOrganizations = organizations.map(org => {
      const totalEnrollees = org._count.principal_accounts
      const totalServices = org.principal_accounts.reduce((sum, account) => {
        return sum + account._count.claims
      }, 0)
      
      const totalClaimsAmount = org.principal_accounts.reduce((sum, account) => {
        return sum + account.claims.reduce((claimSum, claim) => claimSum + Number(claim.amount), 0)
      }, 0)
      
      const approvedClaimsAmount = org.principal_accounts.reduce((sum, account) => {
        return sum + account.claims
          .filter(claim => claim.status === "APPROVED")
          .reduce((claimSum, claim) => claimSum + Number(claim.amount), 0)
      }, 0)

      // Calculate performance score based on claims approval rate and utilization
      const approvalRate = totalServices > 0 ? (approvedClaimsAmount / totalClaimsAmount) * 100 : 0
      const utilizationRate = totalEnrollees > 0 ? (totalServices / totalEnrollees) * 10 : 0 // Services per enrollee * 10
      const performanceScore = Math.min(100, Math.round((approvalRate * 0.7) + (utilizationRate * 0.3)))

      return {
        id: org.id,
        organization_name: org.name,
        enrollees_count: totalEnrollees,
        services_count: totalServices,
        performance_score: performanceScore,
        status: org.status,
        total_claims_amount: totalClaimsAmount,
        approved_claims_amount: approvedClaimsAmount
      }
    })

    return NextResponse.json({
      success: true,
      organizations: formattedOrganizations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error("Error fetching organizations breakdown:", error)
    return NextResponse.json(
      { error: "Failed to fetch organizations breakdown" },
      { status: 500 }
    )
  }
}
