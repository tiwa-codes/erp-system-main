import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { fetchExchangeRateFromAPI, createManualExchangeRate } from "@/lib/exchange-rate"
import { RateType } from "@prisma/client"
import { z } from "zod"

const fetchSchema = z.object({
  from_currency: z.string().length(3, "Currency code must be 3 characters"),
  to_currency: z.string().length(3, "Currency code must be 3 characters"),
  rate_type: z.enum(["BUYING", "SELLING", "MID_MARKET"]).optional(),
})

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
    const validatedData = fetchSchema.parse(body)

    const rateType = (validatedData.rate_type as RateType) || RateType.MID_MARKET

    // Fetch rate from API
    const rate = await fetchExchangeRateFromAPI(
      validatedData.from_currency.toUpperCase(),
      validatedData.to_currency.toUpperCase(),
      rateType
    )

    if (!rate) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch exchange rate from API. Please check API configuration or use manual entry.",
        },
        { status: 400 }
      )
    }

    // Store the fetched rate
    const rateId = await createManualExchangeRate(
      validatedData.from_currency.toUpperCase(),
      validatedData.to_currency.toUpperCase(),
      rate,
      rateType,
      new Date(),
      session.user.id
    )

    return NextResponse.json({
      success: true,
      data: {
        id: rateId,
        from_currency: validatedData.from_currency.toUpperCase(),
        to_currency: validatedData.to_currency.toUpperCase(),
        rate,
        rate_type: rateType,
      },
    })
  } catch (error) {
    console.error("Error fetching exchange rate from API:", error)
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
        error: error instanceof Error ? error.message : "Failed to fetch exchange rate",
      },
      { status: 500 }
    )
  }
}








