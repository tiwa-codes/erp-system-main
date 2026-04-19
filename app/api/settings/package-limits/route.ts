import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"
import { Decimal } from "@prisma/client/runtime/library"

const packageLimitSchema = z.object({
  plan_id: z.string().min(1, "Plan is required"),
  category: z.string().min(1, "Category is required"),
  service_name: z.string().optional(),
  amount: z.number().min(0, "Amount must be positive"),
  default_price: z.number().optional(),
  input_type: z.enum(["NUMBER", "DROPDOWN", "ALPHANUMERIC"]).default("NUMBER"),
  is_customizable: z.boolean().default(true),
  // New fields
  limit_type: z.enum(["PRICE", "FREQUENCY"]).default("PRICE"),
  limit_frequency: z.string().optional(),
  coverage_status: z.enum(["COVERED", "NOT_COVERED"]).default("COVERED"),
})

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
    const limit = parseInt(searchParams.get("limit") || "50") // Increased default limit for grouped view
    const skip = (page - 1) * limit
    const planId = searchParams.get("plan_id")

    const where: any = {}

    if (planId) {
      where.plan_id = planId
    }

    if (search) {
      where.OR = [
        { plan: { name: { contains: search, mode: 'insensitive' as const } } },
        { category: { contains: search, mode: 'insensitive' as const } },
        { service_name: { contains: search, mode: 'insensitive' as const } }
      ]
    }

    const [packageLimits, totalCount] = await Promise.all([
      prisma.packageLimit.findMany({
        where,
        include: {
          plan: {
            select: {
              name: true,
              classification: true
            }
          }
        },
        orderBy: [
          { plan: { name: 'asc' } },
          { category: 'asc' },
          { service_name: 'asc' }
        ],
        // skip, // Commented out skip for now if planId is set to simplify grouped UI fetching
        // take: limit
      }),
      prisma.packageLimit.count({ where })
    ])

    return NextResponse.json({
      success: true,
      data: {
        packageLimits,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      },
      packageLimits, // Backward compatibility
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    })

  } catch (error) {
    console.error("Error fetching package limits:", error)
    return NextResponse.json(
      { error: "Failed to fetch package limits" },
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

    const hasPermission = await checkPermission(session.user.role as any, "settings", "add")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = packageLimitSchema.parse(body)

    // Check for duplicates
    const existingLimit = await prisma.packageLimit.findFirst({
      where: {
        plan_id: validatedData.plan_id,
        category: validatedData.category,
        service_name: validatedData.service_name || null
      }
    })

    if (existingLimit) {
      return NextResponse.json(
        { error: "Benefit configuration already exists for this combination" },
        { status: 400 }
      )
    }

    const packageLimit = await prisma.packageLimit.create({
      data: {
        plan_id: validatedData.plan_id,
        category: validatedData.category,
        service_name: validatedData.service_name,
        amount: new Decimal(validatedData.amount),
        default_price: validatedData.default_price ? new Decimal(validatedData.default_price) : null,
        input_type: validatedData.input_type as any,
        is_customizable: validatedData.is_customizable,
        limit_type: validatedData.limit_type as any,
        limit_frequency: validatedData.limit_frequency,
        coverage_status: validatedData.coverage_status as any
      },
      include: {
        plan: { select: { name: true } }
      }
    })

    return NextResponse.json({ success: true, packageLimit })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Error creating package limit:", error)
    return NextResponse.json({ error: "Failed to create package limit" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const hasPermission = await checkPermission(session.user.role as any, "settings", "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })

    const body = await request.json()
    const validatedData = packageLimitSchema.parse(body)

    const updatedPackageLimit = await prisma.packageLimit.update({
      where: { id },
      data: {
        plan_id: validatedData.plan_id,
        category: validatedData.category,
        service_name: validatedData.service_name,
        amount: new Decimal(validatedData.amount),
        default_price: validatedData.default_price ? new Decimal(validatedData.default_price) : null,
        input_type: validatedData.input_type as any,
        is_customizable: validatedData.is_customizable,
        limit_type: validatedData.limit_type as any,
        limit_frequency: validatedData.limit_frequency,
        coverage_status: validatedData.coverage_status as any
      },
      include: {
        plan: { select: { name: true } }
      }
    })

    return NextResponse.json({ success: true, packageLimit: updatedPackageLimit })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Error updating package limit:", error)
    return NextResponse.json({ error: "Failed to update package limit" }, { status: 500 })
  }
}
