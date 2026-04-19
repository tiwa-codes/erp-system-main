import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const categories = await prisma.benefitCategory.findMany({
      where: {
        package_id: params.id,
        is_active: true
      },
      include: {
        services: {
          where: { is_active: true },
          orderBy: { display_order: "asc" }
        }
      },
      orderBy: { display_order: "asc" }
    })

    return NextResponse.json({ categories }, { status: 200 })
  } catch (err: any) {
    console.error(`GET /api/settings/benefit-packages/[id]/categories error:`, err)
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, price_limit } = body

    if (!name) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 })
    }

    if (price_limit !== null && price_limit !== undefined && price_limit !== "") {
      const parsedPriceLimit = Number(price_limit)
      if (!Number.isFinite(parsedPriceLimit) || parsedPriceLimit < 0) {
        return NextResponse.json(
          { error: "Category price limit must be a valid positive number" },
          { status: 400 }
        )
      }
    }

    // Check if package exists
    const pkg = await prisma.benefitPackage.findUnique({
      where: { id: params.id }
    })

    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 })
    }

    // Check for duplicate category name in this package
    const existing = await prisma.benefitCategory.findFirst({
      where: {
        package_id: params.id,
        name
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: "Category with this name already exists in this package" },
        { status: 400 }
      )
    }

    const category = await prisma.benefitCategory.create({
      data: {
        package_id: params.id,
        name,
        description,
        price_limit:
          price_limit === null || price_limit === undefined || price_limit === ""
            ? null
            : Number(price_limit),
        is_active: true,
        display_order: 0
      }
    })

    return NextResponse.json({ category }, { status: 201 })
  } catch (err: any) {
    console.error(`POST /api/settings/benefit-packages/[id]/categories error:`, err)
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 })
  }
}
