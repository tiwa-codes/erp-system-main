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

    const pkg = await prisma.benefitPackage.findFirst({
      where: { id: params.id },
      include: {
        categories: {
          where: { is_active: true },
          include: {
            services: {
              where: { is_active: true },
              orderBy: { display_order: "asc" }
            }
          },
          orderBy: { display_order: "asc" }
        }
      }
    })

    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 })
    }

    return NextResponse.json({ package: pkg }, { status: 200 })
  } catch (err: any) {
    console.error(`GET /api/settings/benefit-packages/[id] error:`, err)
    return NextResponse.json({ error: "Failed to fetch package" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, price } = body

    const pkg = await prisma.benefitPackage.findUnique({
      where: { id: params.id }
    })

    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 })
    }

    const updated = await prisma.benefitPackage.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: price ? parseFloat(price) : null })
      }
    })

    return NextResponse.json({ package: updated }, { status: 200 })
  } catch (err: any) {
    console.error(`PUT /api/settings/benefit-packages/[id] error:`, err)
    return NextResponse.json({ error: "Failed to update package" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Soft delete by setting is_active to false
    const pkg = await prisma.benefitPackage.update({
      where: { id: params.id },
      data: { is_active: false }
    })

    return NextResponse.json({ message: "Package deleted successfully" }, { status: 200 })
  } catch (err: any) {
    console.error(`DELETE /api/settings/benefit-packages/[id] error:`, err)
    return NextResponse.json({ error: "Failed to delete package" }, { status: 500 })
  }
}
