import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { SalesSubmodule } from "@prisma/client"
import { z } from "zod"

const submodules = Object.values(SalesSubmodule) as [SalesSubmodule, ...SalesSubmodule[]]

const upsertTargetsSchema = z.object({
  region_id: z.string().min(1, "Region is required"),
  branch_id: z.string().min(1, "Branch is required"),
  targets: z.record(z.enum(submodules), z.number().min(0, "Target must be non-negative")),
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

const buildDefaultTargetMap = () =>
  Object.values(SalesSubmodule).reduce<Record<SalesSubmodule, number>>((acc, key) => {
    acc[key] = 0
    return acc
  }, {} as Record<SalesSubmodule, number>)

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const allowed = await canView(String(session.user.role || ""))
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const regionId = searchParams.get("region_id")
    const branchId = searchParams.get("branch_id")

    if (!regionId || !branchId) {
      const all = await prisma.salesBranchTarget.findMany({
        orderBy: [{ region: { name: "asc" } }, { branch: { name: "asc" } }],
        include: {
          region: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true, state: true } },
        },
      })

      return NextResponse.json({ success: true, data: all })
    }

    const targets = await prisma.salesBranchTarget.findMany({
      where: {
        region_id: regionId,
        branch_id: branchId,
      },
      select: {
        submodule: true,
        annual_target: true,
      },
    })

    const mapped = buildDefaultTargetMap()
    for (const item of targets) {
      mapped[item.submodule] = Number(item.annual_target || 0)
    }

    return NextResponse.json({ success: true, data: mapped })
  } catch (error) {
    console.error("GET /api/settings/sales-branch-targets error:", error)
    return NextResponse.json({ error: "Failed to fetch branch targets" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const allowed = await canEdit(String(session.user.role || ""))
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const { region_id, branch_id, targets } = upsertTargetsSchema.parse(body)

    const branch = await prisma.salesBranch.findUnique({
      where: { id: branch_id },
      select: { id: true, region_id: true, is_active: true },
    })

    if (!branch || !branch.is_active) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 })
    }
    if (branch.region_id !== region_id) {
      return NextResponse.json({ error: "Branch does not belong to selected region" }, { status: 400 })
    }

    const entries = Object.entries(targets) as [SalesSubmodule, number][]

    await prisma.$transaction(
      entries.map(([submodule, amount]) =>
        prisma.salesBranchTarget.upsert({
          where: {
            region_id_branch_id_submodule: {
              region_id,
              branch_id,
              submodule,
            },
          },
          create: {
            region_id,
            branch_id,
            submodule,
            annual_target: amount,
          },
          update: {
            annual_target: amount,
          },
        })
      )
    )

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "SALES_BRANCH_TARGETS_UPDATE",
        resource: "sales_branch_targets",
        resource_id: `${region_id}:${branch_id}`,
        new_values: targets,
      },
    })

    return NextResponse.json({ success: true, data: targets })
  } catch (error) {
    console.error("PUT /api/settings/sales-branch-targets error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Invalid payload" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to save branch targets" }, { status: 500 })
  }
}
