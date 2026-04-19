import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { lockExchangeRate } from "@/lib/exchange-rate"

export async function POST(
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
          error: "Exchange rate is already locked",
        },
        { status: 400 }
      )
    }

    await lockExchangeRate(params.id)

    const lockedRate = await prisma.exchangeRate.findUnique({
      where: { id: params.id },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "EXCHANGE_RATE_LOCK",
        resource: "exchange_rate",
        resource_id: params.id,
        new_values: {
          is_locked: true,
          locked_at: lockedRate?.locked_at,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: lockedRate,
    })
  } catch (error) {
    console.error("Error locking exchange rate:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to lock exchange rate",
      },
      { status: 500 }
    )
  }
}








