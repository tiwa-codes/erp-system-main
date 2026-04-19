import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const planClassificationEnum = z.enum(["GENERAL", "CUSTOM"])

const planSchema = z.object({
  name: z.string().min(1, "Plan name is required"),
  description: z.string().optional(),
  plan_type: z.enum(["INDIVIDUAL", "FAMILY", "CORPORATE"]),
  premium_amount: z.number().min(0, "Premium amount must be positive"),
  annual_limit: z.number().min(0, "Annual limit must be positive"),
  band_type: z.string().optional(), // Legacy field
  assigned_bands: z.array(z.string()).optional(), // New band assignment field
  classification: planClassificationEnum.optional(),
})

const PLAN_TYPES = ["INDIVIDUAL", "FAMILY", "CORPORATE"] as const

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has settings permissions
    const hasPermission = await checkPermission(session.user.role as any, "settings", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    const where = (() => {
      if (!search) return {}

      const upperSearch = search.toUpperCase()
      const matchingPlanTypes = PLAN_TYPES.filter((type) => type.includes(upperSearch))

      return {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { band_type: { contains: search, mode: "insensitive" } },
          ...matchingPlanTypes.map((type) => ({ plan_type: type })),
        ],
      }
    })()

    const [plans, totalCount] = await Promise.all([
      prisma.plan.findMany({
        where,
        orderBy: {
          created_at: 'desc'
        },
        skip,
        take: limit,
        include: {
          plan_limits: true,
          coverage_rules: true,
          plan_providers: {
            include: {
              provider: {
                select: {
                  id: true,
                  facility_name: true
                }
              }
            }
          }
        }
      }),
      prisma.plan.count({ where })
    ])

    return NextResponse.json({
      success: true,
      plans,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    })

  } catch (error) {
    console.error("Error fetching plans:", error)
    return NextResponse.json(
      { error: "Failed to fetch plans" },
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

    // Check if user has settings permissions
    const hasPermission = await checkPermission(session.user.role as any, "settings", "add")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    
    // Log the incoming body for debugging
    console.log("POST /api/settings/plans request body:", JSON.stringify(body, null, 2))
    
    let validatedData
    try {
      validatedData = planSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors)
        return NextResponse.json(
          {
            error: "Validation error",
            details: error.errors,
          },
          { status: 400 }
        )
      }
      throw error
    }
    const classification = validatedData.classification ?? "GENERAL"
    const computedStatus = classification === "CUSTOM" ? "IN_PROGRESS" : "COMPLETE"

    // Check if plan with same name already exists
    const existingPlan = await prisma.plan.findFirst({
      where: {
        name: validatedData.name
      }
    })

    if (existingPlan) {
      return NextResponse.json(
        { error: "Plan with this name already exists" },
        { status: 400 }
      )
    }

    // Generate unique plan_id with retry logic
    let nextPlanId: string
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      try {
        // Find the highest numeric plan_id
        const plans = await prisma.plan.findMany({
          select: { plan_id: true },
          orderBy: { created_at: 'desc' }
        })
        
        // Filter and find the highest numeric plan_id
        const numericPlanIds = plans
          .map(p => parseInt(p.plan_id))
          .filter(id => !isNaN(id))
        
        const highestId = numericPlanIds.length > 0 
          ? Math.max(...numericPlanIds)
          : 0
        
        nextPlanId = (highestId + 1).toString()
        
        // Try to create the plan - will fail if plan_id already exists due to race condition
        const plan = await prisma.plan.create({
        data: {
          plan_id: nextPlanId,
          name: validatedData.name,
          description: validatedData.description,
          plan_type: validatedData.plan_type,
          classification,
          premium_amount: validatedData.premium_amount,
          annual_limit: validatedData.annual_limit,
          band_type: validatedData.band_type, // Legacy field
          assigned_bands: validatedData.assigned_bands || [], // New band assignment
          status: computedStatus,
          created_by_id: session.user.id,
        },
        })

        return NextResponse.json({
          success: true,
          plan
        })

      } catch (createError: any) {
        // If it's a unique constraint error on plan_id, retry with a new ID
        if (createError.code === 'P2002' && createError.meta?.target?.includes('plan_id')) {
          attempts++
          console.log(`plan_id ${nextPlanId} already exists, retrying... (attempt ${attempts}/${maxAttempts})`)
          
          if (attempts >= maxAttempts) {
            return NextResponse.json(
              { error: "Failed to generate unique plan_id after multiple attempts. Please try again." },
              { status: 500 }
            )
          }
          
          // Wait a bit before retrying to avoid tight loop
          await new Promise(resolve => setTimeout(resolve, 100))
          continue
        }
        
        // For other errors, throw them
        throw createError
      }
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating plan:", error)
    
    // Check if it's a Prisma unique constraint error
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      const meta = 'meta' in error ? error.meta : null
      return NextResponse.json(
        { 
          error: "A plan with this information already exists",
          details: `Duplicate value for: ${meta && typeof meta === 'object' && 'target' in meta ? (meta.target as string[]).join(', ') : 'unknown field'}`
        },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to create plan" },
      { status: 500 }
    )
  }
}
