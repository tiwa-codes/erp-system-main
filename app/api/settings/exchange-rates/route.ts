import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"
import { ExchangeRateSource, RateType } from "@prisma/client"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

const exchangeRateSchema = z.object({
  from_currency: z.string().length(3, "Currency code must be 3 characters"),
  to_currency: z.string().length(3, "Currency code must be 3 characters"),
  rate: z.number().positive("Rate must be positive"),
  rate_type: z.enum(["BUYING", "SELLING", "MID_MARKET"]),
  source: z.enum(["MANUAL", "AUTOMATIC_API", "FIXED_CONTRACT"]),
  effective_date: z.string().datetime().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "settings", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const fromCurrency = searchParams.get("from_currency")
    const toCurrency = searchParams.get("to_currency")
    const rateType = searchParams.get("rate_type") as RateType | null
    const isLocked = searchParams.get("is_locked")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = Math.min(parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT)), MAX_LIMIT)
    const skip = (page - 1) * limit

    const where: any = {}

    if (fromCurrency) {
      where.from_currency = fromCurrency
    }

    if (toCurrency) {
      where.to_currency = toCurrency
    }

    if (rateType) {
      where.rate_type = rateType
    }

    if (isLocked !== null) {
      where.is_locked = isLocked === "true"
    }

    const [rates, total] = await Promise.all([
      prisma.exchangeRate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { effective_date: "desc" },
        include: {
          created_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      }),
      prisma.exchangeRate.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        rates,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error("Error fetching exchange rates:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch exchange rates",
      },
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

    const canAdd = await checkPermission(session.user.role as any, "settings", "add")
    if (!canAdd) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = exchangeRateSchema.parse(body)

    // Check if rate already exists for this currency pair, rate type, and date
    const effectiveDate = validatedData.effective_date
      ? new Date(validatedData.effective_date)
      : new Date()

    const existingRate = await prisma.exchangeRate.findFirst({
      where: {
        from_currency: validatedData.from_currency,
        to_currency: validatedData.to_currency,
        rate_type: validatedData.rate_type,
        effective_date: {
          gte: new Date(effectiveDate.setHours(0, 0, 0, 0)),
          lt: new Date(effectiveDate.setHours(23, 59, 59, 999)),
        },
        is_locked: false,
      },
    })

    if (existingRate) {
      return NextResponse.json(
        {
          success: false,
          error: "An unlocked rate already exists for this currency pair and date",
        },
        { status: 400 }
      )
    }

    const rate = await prisma.exchangeRate.create({
      data: {
        from_currency: validatedData.from_currency.toUpperCase(),
        to_currency: validatedData.to_currency.toUpperCase(),
        rate: validatedData.rate,
        rate_type: validatedData.rate_type,
        source: validatedData.source,
        effective_date: effectiveDate,
        created_by_id: session.user.id,
      },
      include: {
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "EXCHANGE_RATE_CREATE",
        resource: "exchange_rate",
        resource_id: rate.id,
        new_values: {
          from_currency: rate.from_currency,
          to_currency: rate.to_currency,
          rate: rate.rate,
          rate_type: rate.rate_type,
          source: rate.source,
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: rate,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating exchange rate:", error)
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
        error: error instanceof Error ? error.message : "Failed to create exchange rate",
      },
      { status: 500 }
    )
  }
}








