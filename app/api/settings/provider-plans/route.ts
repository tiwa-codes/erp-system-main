import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const planBandSchema = z.object({
  plan_id: z.string().min(1, "Plan is required"),
  provider_id: z.string().min(1, "Provider is required"),
  band_type: z.string().min(1, "Band type is required"),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has settings permissions
    const hasPermission = await checkPermission(session.user.role as any, "settings", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    const where = search ? {
      OR: [
        { plan: { name: { contains: search, mode: 'insensitive' } } },
        { provider: { facility_name: { contains: search, mode: 'insensitive' } } },
        { band_type: { contains: search, mode: 'insensitive' } },
      ]
    } : {}

    const [planBands, totalCount] = await Promise.all([
      prisma.planBand.findMany({
        where,
        include: {
          plan: {
            select: {
              name: true,
              name: true
            }
          },
          provider: {
            select: {
              facility_name: true,
              hcp_code: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.planBand.count({ where })
    ])

    return NextResponse.json({
      success: true,
      planBands,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    })

  } catch (error) {
    console.error("Error fetching provider plans:", error)
    return NextResponse.json(
      { error: "Failed to fetch provider plans" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has settings permissions
    const hasPermission = await checkPermission(session.user.role as any, "settings", "add")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = planBandSchema.parse(body)

    // Check if plan band already exists
    const existingBand = await prisma.planBand.findFirst({
      where: {
        plan_id: validatedData.plan_id,
        provider_id: validatedData.provider_id
      }
    })

    if (existingBand) {
      return NextResponse.json(
        { error: "Provider is already assigned to this plan" },
        { status: 400 }
      )
    }

    const planBand = await prisma.planBand.create({
      data: {
        plan_id: validatedData.plan_id,
        provider_id: validatedData.provider_id,
        band_type: validatedData.band_type,
      },
      include: {
        plan: {
          select: {
            name: true
          }
        },
        provider: {
          select: {
            facility_name: true,
            hcp_code: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      planBand
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating provider plan:", error)
    return NextResponse.json(
      { error: "Failed to create provider plan" },
      { status: 500 }
    )
  }
}
