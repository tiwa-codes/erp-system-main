import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission
    const hasPermission = await checkPermission(session.user.role as any, "settings", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const facilityId = searchParams.get("facility_id")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""

    if (!facilityId) {
      return NextResponse.json({ error: "Facility ID is required" }, { status: 400 })
    }

    // Build where clause
    const where: any = {
      plan_bands: {
        some: {
          provider_id: facilityId
        }
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { plan_type: { contains: search, mode: "insensitive" } }
      ]
    }

    // Get plans for this facility
    const [plans, totalCount] = await Promise.all([
      prisma.plan.findMany({
        where,
        include: {
          _count: {
            select: {
              covered_services: {
                where: {
                  facility_id: facilityId
                }
              }
            }
          }
        },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.plan.count({ where })
    ])

    const pagination = {
      page,
      limit,
      total: totalCount,
      pages: Math.ceil(totalCount / limit)
    }

    return NextResponse.json({
      success: true,
      plans,
      pagination,
      totalCount
    })

  } catch (error) {
    console.error("Error fetching facility plans:", error)
    return NextResponse.json(
      { error: "Failed to fetch facility plans" },
      { status: 500 }
    )
  }
}
