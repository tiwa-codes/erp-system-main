import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const bandLabelSchema = z.object({
  label: z.string().min(1, "Label is required").max(50, "Label must be less than 50 characters"),
  description: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE")
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission - Allow both Underwriting and Provider Access
    const canViewUnderwriting = await checkPermission(session.user.role as any, "underwriting", "view")
    const canViewProvider = await checkPermission(session.user.role as any, "provider", "view")
    const canManageProvider = await checkPermission(session.user.role as any, "provider", "manage")
    const canApproveProvider = await checkPermission(session.user.role as any, "provider", "approve")

    if (!canViewUnderwriting && !canViewProvider && !canManageProvider && !canApproveProvider) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")

    // Build where clause
    const where: any = {}
    if (search) {
      where.OR = [
        { label: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } }
      ]
    }
    if (status) {
      where.status = status
    }

    // Fetch band labels with pagination
    const [bandLabels, total] = await Promise.all([
      prisma.bandLabel.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          label: "asc"
        }
      }),
      prisma.bandLabel.count({ where })
    ])

    return NextResponse.json({
      success: true,
      band_labels: bandLabels,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching band labels:", error)
    return NextResponse.json(
      { error: "Failed to fetch band labels" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission
    const hasPermission = await checkPermission(session.user.role as any, "underwriting", "add")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = bandLabelSchema.parse(body)

    // Check if label already exists
    const existingBandLabel = await prisma.bandLabel.findFirst({
      where: {
        label: validatedData.label
      }
    })

    if (existingBandLabel) {
      return NextResponse.json(
        { error: "Band label with this name already exists" },
        { status: 400 }
      )
    }

    // Create band label
    const bandLabel = await prisma.bandLabel.create({
      data: {
        label: validatedData.label,
        description: validatedData.description || null,
        status: validatedData.status
      }
    })

    return NextResponse.json({
      success: true,
      band_label: bandLabel
    })
  } catch (error) {
    console.error("Error creating band label:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to create band label" },
      { status: 500 }
    )
  }
}

