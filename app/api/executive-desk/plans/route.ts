import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { ApprovalStage, PlanStatus } from "@prisma/client"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check executive-desk permissions
    const canView = await checkPermission(session.user.role as any, "executive-desk", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim()
    const statusParam = searchParams.get("status")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = Math.min(parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT)), MAX_LIMIT)
    const skip = (page - 1) * limit

    const where: any = {
      approval_stage: ApprovalStage.MD,
      status: PlanStatus.PENDING_APPROVAL,
    }

    if (statusParam && statusParam !== "all") {
      where.status = statusParam.toUpperCase()
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { plan_id: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    const [plans, total] = await Promise.all([
      prisma.plan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          created_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          special_risk_approved_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          plan_limits: true,
          covered_services: true,
          package_limits: true,
        },
      }),
      prisma.plan.count({ where }),
    ])

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "EXECUTIVE_DESK_PLANS_VIEW",
        resource: "executive_desk_plans",
        new_values: {
          page,
          limit,
          filters: { search, status: statusParam },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        plans,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error("Error fetching Executive Desk plans:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch plans",
      },
      { status: 500 }
    )
  }
}








