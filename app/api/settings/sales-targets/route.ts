import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { DEFAULT_SALES_TARGETS, type SalesSubmoduleKey } from "@/lib/sales"

const CONFIG_KEY = "sales_target_amounts"

const normalizeTargets = (raw: unknown): Record<SalesSubmoduleKey, number> => {
  const base = { ...DEFAULT_SALES_TARGETS }

  if (!raw || typeof raw !== "object") return base

  for (const key of Object.keys(base) as SalesSubmoduleKey[]) {
    const value = (raw as Record<string, unknown>)[key]
    const numeric = Number(value)
    if (!Number.isNaN(numeric) && numeric >= 0) {
      base[key] = numeric
    }
  }

  return base
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canViewSettings = await checkPermission(session.user.role as any, "settings", "view")
    const canViewSales = await checkPermission(session.user.role as any, "sales", "view")
    const canViewSalesAll = await checkPermission(session.user.role as any, "sales", "view_all")
    if (!canViewSettings && !canViewSales && !canViewSalesAll) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const config = await prisma.systemConfig.findUnique({
      where: { key: CONFIG_KEY },
      select: { value: true },
    })

    let parsed: unknown = null
    if (config?.value) {
      try {
        parsed = JSON.parse(config.value)
      } catch {
        parsed = null
      }
    }

    const targets = normalizeTargets(parsed)
    return NextResponse.json({ targets })
  } catch (error) {
    console.error("GET /api/settings/sales-targets error:", error)
    return NextResponse.json({ error: "Failed to fetch sales targets" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canEdit = await checkPermission(session.user.role as any, "settings", "edit")
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const targets = normalizeTargets(body?.targets)

    await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      create: {
        key: CONFIG_KEY,
        value: JSON.stringify(targets),
        description: "Configurable sales target amount per sales submodule",
        is_active: true,
      },
      update: {
        value: JSON.stringify(targets),
        is_active: true,
      },
    })

    return NextResponse.json({ targets })
  } catch (error) {
    console.error("PUT /api/settings/sales-targets error:", error)
    return NextResponse.json({ error: "Failed to update sales targets" }, { status: 500 })
  }
}
