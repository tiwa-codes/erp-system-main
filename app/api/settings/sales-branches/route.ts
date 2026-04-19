import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const createBranchSchema = z.object({
  region_id: z.string().min(1, "Region is required"),
  name: z.string().trim().min(2, "Branch name is required"),
  state: z.string().trim().min(2, "State is required"),
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
    const regionId = searchParams.get("region_id")

    const branches = await prisma.salesBranch.findMany({
      where: {
        is_active: true,
        ...(regionId ? { region_id: regionId } : {}),
      },
      orderBy: [{ state: "asc" }, { name: "asc" }],
      include: {
        region: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json({ success: true, data: branches })
  } catch (error) {
    console.error("GET /api/settings/sales-branches error:", error)
    return NextResponse.json({ error: "Failed to fetch sales branches" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const allowed = await canEdit(String(session.user.role || ""))
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const { region_id, name, state } = createBranchSchema.parse(body)

    const region = await prisma.salesRegion.findUnique({
      where: { id: region_id },
      select: { id: true, name: true, is_active: true },
    })

    if (!region || !region.is_active) {
      return NextResponse.json({ error: "Selected region does not exist" }, { status: 404 })
    }

    const exists = await prisma.salesBranch.findFirst({
      where: {
        region_id,
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    })
    if (exists) {
      return NextResponse.json({ error: "Branch already exists in selected region" }, { status: 409 })
    }

    const branch = await prisma.salesBranch.create({
      data: {
        region_id,
        name,
        state,
      },
      include: {
        region: {
          select: { id: true, name: true },
        },
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "SALES_BRANCH_CREATE",
        resource: "sales_branch",
        resource_id: branch.id,
        new_values: {
          id: branch.id,
          region_id: branch.region_id,
          region_name: branch.region?.name || null,
          name: branch.name,
          state: branch.state,
        },
      },
    })

    return NextResponse.json({ success: true, data: branch }, { status: 201 })
  } catch (error) {
    console.error("POST /api/settings/sales-branches error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Invalid payload" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create sales branch" }, { status: 500 })
  }
}
