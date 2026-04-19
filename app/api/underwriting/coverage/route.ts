import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { coverageSchema } from "./schema"
import { z } from "zod"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "underwriting", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Rules are no longer filtered by plan - they are global rules based on AGE and MARITAL status
    const rules = await prisma.coverageRule.findMany({
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            plan_type: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    })

    return NextResponse.json({ success: true, rules })
  } catch (error) {
    console.error("Error fetching coverage rules:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch coverage rules" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canAdd = await checkPermission(session.user.role as any, "underwriting", "add")
    if (!canAdd) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = coverageSchema.parse(body)

    // Remove plan_id from data if present (rules are global, not plan-specific)
    const { plan_id, ...ruleData } = parsed

    const rule = await prisma.coverageRule.create({
      data: {
        ...ruleData,
        plan_id: null, // Set to null since rules are global
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            plan_type: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, rule }, { status: 201 })
  } catch (error) {
    console.error("Error creating coverage rule:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: "Failed to create coverage rule" },
      { status: 500 }
    )
  }
}

