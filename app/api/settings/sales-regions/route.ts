import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const createRegionSchema = z.object({
  name: z.string().trim().min(2, "Region name is required"),
})

async function canView(sessionRole: string) {
  const [canViewSettings, canViewSales, canViewSalesAll] = await Promise.all([
    checkPermission(sessionRole as any, "settings", "view"),
    checkPermission(sessionRole as any, "sales", "view"),
    checkPermission(sessionRole as any, "sales", "view_all"),
  ])

  return canViewSettings || canViewSales || canViewSalesAll
}

async function canEdit(sessionRole: string) {
  const [canEditSettings, canEditSales] = await Promise.all([
    checkPermission(sessionRole as any, "settings", "edit"),
    checkPermission(sessionRole as any, "sales", "edit"),
  ])

  return canEditSettings || canEditSales
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const allowed = await canView(String(session.user.role || ""))
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const includeBranches = searchParams.get("include_branches") !== "false"

    const regions = await prisma.salesRegion.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
      include: includeBranches
        ? {
            branches: {
              where: { is_active: true },
              orderBy: [{ state: "asc" }, { name: "asc" }],
            },
          }
        : undefined,
    })

    return NextResponse.json({ success: true, data: regions })
  } catch (error) {
    console.error("GET /api/settings/sales-regions error:", error)
    return NextResponse.json({ error: "Failed to fetch sales regions" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const allowed = await canEdit(String(session.user.role || ""))
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const { name } = createRegionSchema.parse(body)

    const exists = await prisma.salesRegion.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    })
    if (exists) {
      return NextResponse.json({ error: "Region already exists" }, { status: 409 })
    }

    const region = await prisma.salesRegion.create({
      data: { name },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "SALES_REGION_CREATE",
        resource: "sales_region",
        resource_id: region.id,
        new_values: region,
      },
    })

    return NextResponse.json({ success: true, data: region }, { status: 201 })
  } catch (error) {
    console.error("POST /api/settings/sales-regions error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Invalid payload" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create sales region" }, { status: 500 })
  }
}
