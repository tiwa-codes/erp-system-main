import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const planId = new URL(request.url).searchParams.get("planId")
    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 })
    }

    const hasPermission = await checkPermission(session.user.role as any, "settings", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const planLimits = await prisma.planLimit.findMany({
      where: { plan_id: planId },
      orderBy: { limit_type: "asc" }
    })

    return NextResponse.json({
      success: true,
      planLimits
    })
  } catch (error) {
    console.error("Error fetching plan limits:", error)
    return NextResponse.json({ error: "Failed to fetch plan limits" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const hasPermission = await checkPermission(session.user.role as any, "settings", "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const {
      plan_id,
      limit_type,
      category_id,
      service_id,
      price_limit,
      frequency_limit
    } = body

    if (!plan_id || !limit_type) {
      return NextResponse.json({ error: "plan_id and limit_type are required" }, { status: 400 })
    }

    const targetCategory = category_id || null
    const targetService = service_id || null

    const planLimit = await prisma.planLimit.upsert({
      where: {
        plan_id_limit_type_category_id_service_id: {
          plan_id,
          limit_type,
          category_id: targetCategory,
          service_id: targetService
        }
      },
      update: {
        price_limit: price_limit ?? undefined,
        frequency_limit: frequency_limit ?? undefined,
      },
      create: {
        plan_id,
        limit_type,
        category_id: targetCategory,
        service_id: targetService,
        price_limit: price_limit ?? undefined,
        frequency_limit: frequency_limit ?? undefined
      }
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "PLAN_LIMIT_UPSERT",
        resource: "plan_limit",
        resource_id: planLimit.id,
        new_values: planLimit
      }
    })

    return NextResponse.json({
      success: true,
      planLimit
    })
  } catch (error) {
    console.error("Error saving plan limit:", error)
    return NextResponse.json({ error: "Failed to save plan limit" }, { status: 500 })
  }
}








