import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { ApprovalStage, PlanStatus } from "@prisma/client"
import { z } from "zod"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check special-risk permissions
    const canView = await checkPermission(session.user.role as any, "special-risk", "view")
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
      approval_stage: ApprovalStage.SPECIAL_RISK,
      status: {
        in: [PlanStatus.PENDING_APPROVAL, PlanStatus.DRAFT, PlanStatus.IN_PROGRESS],
      },
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
        action: "SPECIAL_RISK_PLANS_VIEW",
        resource: "special_risk_plans",
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
    console.error("Error fetching Special Services plans:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch plans",
      },
      { status: 500 }
    )
  }
}

const createDraftSchema = z.object({
  name: z.string().min(1, "Plan name is required"),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canAdd = await checkPermission(session.user.role as any, "special-risk", "add")
    if (!canAdd) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { name } = createDraftSchema.parse(body)
    let plan: { id: string; plan_id: string; name: string } | null = null
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts && !plan) {
      try {
        const plans = await prisma.plan.findMany({
          select: { plan_id: true },
          orderBy: { created_at: "desc" },
        })

        const numericPlanIds = plans
          .map((p) => parseInt(p.plan_id, 10))
          .filter((id) => !Number.isNaN(id))

        const highestId = numericPlanIds.length > 0 ? Math.max(...numericPlanIds) : 0
        const nextPlanId = String(highestId + 1)

        plan = await prisma.plan.create({
          data: {
            plan_id: nextPlanId,
            name: name.trim(),
            description: "",
            plan_type: "FAMILY",
            premium_amount: 0,
            annual_limit: 0,
            band_type: "NONE",
            assigned_bands: [],
            classification: "CUSTOM",
            approval_stage: ApprovalStage.SPECIAL_RISK,
            status: PlanStatus.DRAFT,
            created_by_id: session.user.id,
            metadata: {
              specialServiceConfig: {
                enabled: true,
                accountTypes: ["INDIVIDUAL", "FAMILY"],
                accountTypePrices: {
                  INDIVIDUAL: 0,
                  FAMILY: 0,
                },
                unlimitedAnnualLimit: false,
                totalAnnualLimit: null,
                regionOfCover: "",
                hospitalTiers: [],
                plans: [
                  {
                    id: `plan-${Date.now()}-1`,
                    name: "Plan 1",
                    individualPrice: 0,
                    familyPrice: 0,
                    individualLimit: null,
                    familyLimit: null,
                    individualUnlimited: false,
                    familyUnlimited: false,
                    hospitalTiers: [],
                  },
                ],
                table: {
                  columns: ["Plan 1"],
                  categories: [],
                },
              },
            },
          },
          select: {
            id: true,
            plan_id: true,
            name: true,
          },
        })
      } catch (createError: any) {
        if (createError?.code === "P2002" && createError?.meta?.target?.includes("plan_id")) {
          attempts += 1
          await new Promise((resolve) => setTimeout(resolve, 100))
          continue
        }
        throw createError
      }
    }

    if (!plan) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to generate unique plan_id after multiple attempts. Please try again.",
        },
        { status: 500 }
      )
    }

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "SPECIAL_RISK_CUSTOM_PLAN_CREATE_DRAFT",
        resource: "plan",
        resource_id: plan.id,
        new_values: { plan_id: plan.plan_id, name: plan.name },
      },
    })

    return NextResponse.json({
      success: true,
      data: { plan },
    })
  } catch (error) {
    console.error("Error creating Special Services plan draft:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors,
        },
        { status: 400 }
      )
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create draft",
      },
      { status: 500 }
    )
  }
}







