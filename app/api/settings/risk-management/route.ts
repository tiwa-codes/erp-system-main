import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const riskProfileSchema = z.object({
  provider_id: z.string().min(1, "Provider is required"),
  risk_score: z.number().min(0).max(100, "Risk score must be between 0 and 100"),
  risk_level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  assessment_date: z.string().min(1, "Assessment date is required"),
  notes: z.string().optional(),
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
        { provider: { facility_name: { contains: search, mode: 'insensitive' } } },
        { risk_level: { contains: search, mode: 'insensitive' } },
      ]
    } : {}

    const [riskProfiles, totalCount] = await Promise.all([
      prisma.riskProfile.findMany({
        where,
        include: {
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
      prisma.riskProfile.count({ where })
    ])

    return NextResponse.json({
      success: true,
      riskProfiles,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    })

  } catch (error) {
    console.error("Error fetching risk profiles:", error)
    return NextResponse.json(
      { error: "Failed to fetch risk profiles" },
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
    const validatedData = riskProfileSchema.parse(body)

    // Check if risk profile already exists for this provider
    const existingProfile = await prisma.riskProfile.findFirst({
      where: {
        provider_id: validatedData.provider_id,
        status: "ACTIVE"
      }
    })

    if (existingProfile) {
      return NextResponse.json(
        { error: "Active risk profile already exists for this provider" },
        { status: 400 }
      )
    }

    const riskProfile = await prisma.riskProfile.create({
      data: {
        provider_id: validatedData.provider_id,
        risk_score: validatedData.risk_score,
        risk_level: validatedData.risk_level,
        assessment_date: new Date(validatedData.assessment_date),
        last_reviewed: new Date(),
        notes: validatedData.notes,
        status: "ACTIVE"
      },
      include: {
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
      riskProfile
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating risk profile:", error)
    return NextResponse.json(
      { error: "Failed to create risk profile" },
      { status: 500 }
    )
  }
}
