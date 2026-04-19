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

    const category = await prisma.benefitCategory.findUnique({
      where: { id: params.categoryId },
      include: {
        services: {
          where: { is_active: true },
          orderBy: { display_order: "asc" }
        }
      }
    })

    if (!category || category.package_id !== params.id) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    return NextResponse.json({ category }, { status: 200 })
  } catch (err: any) {
    console.error(`GET /api/settings/benefit-packages/[id]/categories/[categoryId] error:`, err)
    return NextResponse.json({ error: "Failed to fetch category" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; categoryId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, price_limit } = body

    const category = await prisma.benefitCategory.findUnique({
      where: { id: params.categoryId }
    })

    if (!category || category.package_id !== params.id) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
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

    const updated = await prisma.benefitCategory.update({
      where: { id: params.categoryId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(price_limit !== undefined && {
          price_limit:
            price_limit === null || price_limit === ""
              ? null
              : Number(price_limit),
        }),
      }
    })

    return NextResponse.json({ category: updated }, { status: 200 })
  } catch (err: any) {
    console.error(`PUT /api/settings/benefit-packages/[id]/categories/[categoryId] error:`, err)
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; categoryId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const category = await prisma.benefitCategory.findUnique({
      where: { id: params.categoryId }
    })

    if (!category || category.package_id !== params.id) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    // Soft delete category and all its services
    await Promise.all([
      prisma.benefitCategory.update({
        where: { id: params.categoryId },
        data: { is_active: false }
      }),
      prisma.benefitService.updateMany({
        where: { category_id: params.categoryId },
        data: { is_active: false }
      })
    ])

    return NextResponse.json({ message: "Category deleted successfully" }, { status: 200 })
  } catch (err: any) {
    console.error(`DELETE /api/settings/benefit-packages/[id]/categories/[categoryId] error:`, err)
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 })
  }
}
