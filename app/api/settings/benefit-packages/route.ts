import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const classification = searchParams.get("classification")
    const limit = parseInt(searchParams.get("limit") || "100")
    const offset = parseInt(searchParams.get("offset") || "0")

    const where: any = { is_active: true }
    if (classification) {
      where.classification = classification
    }

    const [packages, total] = await Promise.all([
      prisma.benefitPackage.findMany({
        where,
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
        },
        orderBy: { name: "asc" },
        take: limit,
        skip: offset
      }),
      prisma.benefitPackage.count({ where })
    ])

    return NextResponse.json({ packages, total }, { status: 200 })
  } catch (err: any) {
    console.error("GET /api/settings/benefit-packages error:", err)
    return NextResponse.json({ error: "Failed to fetch packages" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, classification, description, price } = body

    if (!name || !classification) {
      return NextResponse.json(
        { error: "Name and classification are required" },
        { status: 400 }
      )
    }

    // Check if package with this name and classification already exists
    const existing = await prisma.benefitPackage.findFirst({
      where: { 
        name,
        classification
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: "Package with this name and classification already exists" },
        { status: 400 }
      )
    }

    const pkg = await prisma.benefitPackage.create({
      data: {
        name,
        classification,
        description,
        price: price ? parseFloat(price) : null,
        is_active: true
      }
    })

    return NextResponse.json({ package: pkg }, { status: 201 })
  } catch (err: any) {
    console.error("POST /api/settings/benefit-packages error:", err)
    return NextResponse.json({ error: "Failed to create package" }, { status: 500 })
  }
}
