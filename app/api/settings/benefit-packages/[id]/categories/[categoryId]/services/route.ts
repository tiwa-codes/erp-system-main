import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; categoryId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const services = await prisma.benefitService.findMany({
      where: {
        category_id: params.categoryId,
        is_active: true
      },
      orderBy: { display_order: "asc" }
    })

    return NextResponse.json({ services }, { status: 200 })
  } catch (err: any) {
    console.error(`GET /api/settings/benefit-packages/[id]/categories/[categoryId]/services error:`, err)
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; categoryId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, limit_type, limit_value, limit_frequency, coverage_status } = body

    if (!name) {
      return NextResponse.json({ error: "Service name is required" }, { status: 400 })
    }

    if (!limit_type || !["PRICE", "FREQUENCY"].includes(limit_type)) {
      // Only require limit_type if coverage is COVERED
      if (coverage_status === "COVERED") {
        return NextResponse.json({ error: "Valid limit_type is required for covered services (PRICE or FREQUENCY)" }, { status: 400 })
      }
    }

    // Check if category exists
    const category = await prisma.benefitCategory.findUnique({
      where: { id: params.categoryId }
    })

    if (!category || category.package_id !== params.id) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    // Check for duplicate service name in this category
    const existing = await prisma.benefitService.findFirst({
      where: {
        category_id: params.categoryId,
        name
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: "Service with this name already exists in this category" },
        { status: 400 }
      )
    }

    const service = await prisma.benefitService.create({
      data: {
        category_id: params.categoryId,
        name,
        description,
        limit_type: limit_type || null,
        limit_value: limit_type === "PRICE" ? parseFloat(limit_value || "0") : null,
        limit_frequency: limit_type === "FREQUENCY" ? limit_frequency : null,
        coverage_status: coverage_status || "COVERED",
        is_active: true,
        is_customizable: true,
        display_order: 0
      }
    })

    return NextResponse.json({ service }, { status: 201 })
  } catch (err: any) {
    console.error(`POST /api/settings/benefit-packages/[id]/categories/[categoryId]/services error:`, err)
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 })
  }
}
