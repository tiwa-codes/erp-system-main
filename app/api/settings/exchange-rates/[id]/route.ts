import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const exchangeRateUpdateSchema = z.object({
  rate: z.number().positive("Rate must be positive").optional(),
  effective_date: z.string().datetime().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "settings", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const rate = await prisma.exchangeRate.findUnique({
      where: { id: params.id },
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

    if (!rate) {
      return NextResponse.json({ error: "Exchange rate not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: rate,
    })
  } catch (error) {
    console.error("Error fetching exchange rate:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch exchange rate",
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canEdit = await checkPermission(session.user.role as any, "settings", "edit")
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const rate = await prisma.exchangeRate.findUnique({
      where: { id: params.id },
    })

    if (!rate) {
      return NextResponse.json({ error: "Exchange rate not found" }, { status: 404 })
    }

    if (rate.is_locked) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot update locked exchange rate",
        },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = exchangeRateUpdateSchema.parse(body)

    const updateData: any = {}
    if (validatedData.rate !== undefined) {
      updateData.rate = validatedData.rate
    }
    if (validatedData.effective_date) {
      updateData.effective_date = new Date(validatedData.effective_date)
    }

    const updatedRate = await prisma.exchangeRate.update({
      where: { id: params.id },
      data: updateData,
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
        action: "EXCHANGE_RATE_UPDATE",
        resource: "exchange_rate",
        resource_id: updatedRate.id,
        old_values: {
          rate: rate.rate,
          effective_date: rate.effective_date,
        },
        new_values: {
          rate: updatedRate.rate,
          effective_date: updatedRate.effective_date,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedRate,
    })
  } catch (error) {
    console.error("Error updating exchange rate:", error)
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
        error: error instanceof Error ? error.message : "Failed to update exchange rate",
      },
      { status: 500 }
    )
  }
}








