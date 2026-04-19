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
  plan_type: z.enum(["INDIVIDUAL", "FAMILY", "CORPORATE"]).optional(),
  premium_amount: z.number().min(0, "Premium amount must be positive").optional(),
  annual_limit: z.number().min(0, "Annual limit must be positive").optional(),
  band_type: z.string().optional(), // Legacy field
  assigned_bands: z.array(z.string()).optional(), // New band assignment field
  classification: planClassificationEnum.optional(),
  special_service_mode: z.boolean().optional(),
  account_types: z.array(z.enum(["INDIVIDUAL", "FAMILY", "CORPORATE"])).optional(),
  account_type_prices: z.record(z.number().min(0)).optional(),
  unlimited_annual_limit: z.boolean().optional(),
  hospital_tiers: z.array(z.string()).optional(),
  region_of_cover: z.string().optional(),
  is_custom_draft: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
})

const PLAN_TYPES = ["INDIVIDUAL", "FAMILY", "CORPORATE"] as const

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has underwriting permissions
    const hasPermission = await checkPermission(session.user.role as any, "underwriting", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const classification = searchParams.get("classification") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}

    // Status filter - by default exclude INACTIVE plans
    if (status && status !== 'all') {
      where.status = status
    } else if (!status) {
      // Default: exclude INACTIVE plans
      where.status = {
        not: 'INACTIVE'
      }
    }
    // If status === 'all', don't add status filter (show all)

    // Search filter
    if (search) {
      const upperSearch = search.toUpperCase()
      const matchingPlanTypes = PLAN_TYPES.filter((type) => type.includes(upperSearch))

      where.OR = [
        { plan_id: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { band_type: { contains: search, mode: "insensitive" } },
        ...matchingPlanTypes.map((type) => ({ plan_type: type })),
      ]
    }

    if (classification && ["GENERAL", "CUSTOM"].includes(classification.toUpperCase())) {
      where.classification = classification.toUpperCase()
    }

    const [plans, totalCount] = await Promise.all([
      prisma.plan.findMany({
        where,
        orderBy: {
          created_at: 'desc'
        },
        skip,
        take: limit,
        select: {
          id: true,
          plan_id: true,
          name: true,
          description: true,
          plan_type: true,
          classification: true,
          premium_amount: true,
          annual_limit: true,
          band_type: true,
          assigned_bands: true,
          metadata: true,
          status: true,
          approval_stage: true,
          created_at: true,
          updated_at: true,
          organization: {
            select: {
              name: true
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

    // Check if user has underwriting permissions
    const hasPermission = await checkPermission(session.user.role as any, "underwriting", "add")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    
    // Log the incoming body for debugging
    console.log("POST /api/underwriting/plans request body:", JSON.stringify(body, null, 2))
    
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
    const isCustomSpecialService =
      classification === "CUSTOM" &&
      (validatedData.special_service_mode === true || (validatedData.account_types?.length || 0) > 0)
    const isCustomDraft = Boolean(validatedData.is_custom_draft)

    const accountTypes = Array.from(new Set(validatedData.account_types || []))
    const accountTypePriceMap = validatedData.account_type_prices || {}
    const unlimitedAnnualLimit = Boolean(validatedData.unlimited_annual_limit)
    const hospitalTiers = (validatedData.hospital_tiers || [])
      .map((tier) => tier.trim())
      .filter(Boolean)
    const regionOfCover = validatedData.region_of_cover?.trim() || ""

    if (!isCustomSpecialService) {
      if (!validatedData.plan_type) {
        return NextResponse.json(
          { error: "Validation error", details: [{ field: "plan_type", message: "Plan type is required" }] },
          { status: 400 }
        )
      }
      if (validatedData.premium_amount === undefined || validatedData.premium_amount <= 0) {
        return NextResponse.json(
          { error: "Validation error", details: [{ field: "premium_amount", message: "Premium amount must be a positive number" }] },
          { status: 400 }
        )
      }
      if (validatedData.annual_limit === undefined || validatedData.annual_limit <= 0) {
        return NextResponse.json(
          { error: "Validation error", details: [{ field: "annual_limit", message: "Annual limit must be a positive number" }] },
          { status: 400 }
        )
      }
    } else if (!isCustomDraft) {
      if (accountTypes.length === 0) {
        return NextResponse.json(
          { error: "Validation error", details: [{ field: "account_types", message: "Select at least one account type for custom special service plans" }] },
          { status: 400 }
        )
      }

      const missingPrices = accountTypes.filter((type) => {
        const value = accountTypePriceMap[type]
        return value === undefined || value === null || Number(value) <= 0
      })

      if (missingPrices.length > 0) {
        return NextResponse.json(
          {
            error: "Validation error",
            details: [{
              field: "account_type_prices",
              message: `Provide a valid price for: ${missingPrices.join(", ")}`,
            }],
          },
          { status: 400 }
        )
      }

      if (!unlimitedAnnualLimit && (validatedData.annual_limit === undefined || validatedData.annual_limit <= 0)) {
        return NextResponse.json(
          {
            error: "Validation error",
            details: [{ field: "annual_limit", message: "Total annual limit is required unless Unlimited is checked" }],
          },
          { status: 400 }
        )
      }
    }

    const effectiveAccountTypes = accountTypes.length > 0 ? accountTypes : (["INDIVIDUAL"] as const)

    const primaryPlanType: typeof PLAN_TYPES[number] =
      isCustomSpecialService
        ? (effectiveAccountTypes.includes("FAMILY")
            ? "FAMILY"
            : effectiveAccountTypes.includes("INDIVIDUAL")
              ? "INDIVIDUAL"
              : effectiveAccountTypes[0]) as typeof PLAN_TYPES[number]
        : (validatedData.plan_type as typeof PLAN_TYPES[number])

    const primaryPremium =
      isCustomSpecialService
        ? Number(accountTypePriceMap[primaryPlanType] || (isCustomDraft ? 0 : 0))
        : Number(validatedData.premium_amount || 0)

    const computedAnnualLimit =
      isCustomSpecialService
        ? (unlimitedAnnualLimit ? 0 : Number(validatedData.annual_limit || 0))
        : Number(validatedData.annual_limit || 0)

    const mergedMetadata = {
      ...(validatedData.metadata || {}),
      ...(isCustomSpecialService
        ? {
            specialServiceConfig: {
              enabled: true,
              accountTypes: effectiveAccountTypes,
              accountTypePrices: effectiveAccountTypes.reduce<Record<string, number>>((acc, type) => {
                const parsedValue = Number(accountTypePriceMap[type])
                acc[type] = Number.isFinite(parsedValue) ? parsedValue : 0
                return acc
              }, {}),
              unlimitedAnnualLimit,
              totalAnnualLimit: unlimitedAnnualLimit ? null : computedAnnualLimit,
              regionOfCover,
              hospitalTiers,
              table: {
                columns: hospitalTiers,
                categories: [],
              },
            },
          }
        : {}),
    }

    const computedStatus = classification === "CUSTOM" ? (isCustomDraft ? "DRAFT" : "IN_PROGRESS") : "COMPLETE"

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
          plan_type: primaryPlanType,
          classification,
          premium_amount: primaryPremium,
          annual_limit: computedAnnualLimit,
          band_type: validatedData.band_type, // Legacy field
          assigned_bands: isCustomSpecialService
            ? (hospitalTiers.length > 0 ? hospitalTiers : (validatedData.assigned_bands || []))
            : (validatedData.assigned_bands || []), // New band assignment
          metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
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
