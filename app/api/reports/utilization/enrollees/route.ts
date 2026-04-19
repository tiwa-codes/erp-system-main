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
    const plan = searchParams.get("plan")
    const status = searchParams.get("status")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    if (plan && plan !== "all") {
      where.plan_id = plan
    }
    if (status && status !== "all") {
      where.status = status
    }

    // Build date filter for claims
    const dateFilter: any = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate)
    }

    const [enrollees, total] = await Promise.all([
      prisma.principalAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              premium_amount: true,
              annual_limit: true
            }
          },
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
      }),
      prisma.principalAccount.count({ where })
    ])

    // Format enrollees with utilization data
    const formattedEnrollees = enrollees.map(enrollee => {
      const totalClaimsAmount = enrollee.claims.reduce((sum, claim) => sum + Number(claim.amount), 0)
      const approvedClaimsAmount = enrollee.claims
        .filter(claim => claim.status === "APPROVED")
        .reduce((sum, claim) => sum + Number(claim.amount), 0)
      
      const planLimit = Number(enrollee.plan?.annual_limit || 0)
      const balance = planLimit - approvedClaimsAmount

      return {
        id: enrollee.id,
        enrollee_id: enrollee.enrollee_id,
        enrollee_name: `${enrollee.first_name} ${enrollee.last_name}`,
        plan_name: enrollee.plan?.name || "No Plan",
        amount_utilized: approvedClaimsAmount,
        balance: Math.max(0, balance),
        status: enrollee.status,
        total_claims: enrollee._count.claims,
        plan_premium: Number(enrollee.plan?.premium_amount || 0)
      }
    })

    return NextResponse.json({
      success: true,
      enrollees: formattedEnrollees,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error("Error fetching enrollees utilization:", error)
    return NextResponse.json(
      { error: "Failed to fetch enrollees utilization" },
      { status: 500 }
    )
  }
}
