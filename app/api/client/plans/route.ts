import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function requireClientRole(role?: string) {
  return role?.toUpperCase() === "GUEST_OR_CLIENT"
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!requireClientRole(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Client module should show the same package hierarchy used in Settings > Benefit Packages.
    const packages = await prisma.benefitPackage.findMany({
      where: { is_active: true },
      include: {
        categories: {
          where: { is_active: true },
          include: {
            services: {
              where: { is_active: true },
              orderBy: { display_order: "asc" },
            },
          },
          orderBy: { display_order: "asc" },
        },
      },
      orderBy: { name: "asc" },
    })

    const data = packages.map((pkg: any) => {
      const categories: Record<string, Array<any>> = {}
      const category_limits: Record<string, number | null> = {}

      for (const category of pkg.categories || []) {
        if (!categories[category.name]) {
          categories[category.name] = []
        }
        const categoryPriceLimit =
          category.price_limit === null || category.price_limit === undefined
            ? null
            : Number(category.price_limit)
        category_limits[category.name] = categoryPriceLimit

        for (const service of category.services || []) {
          categories[category.name].push({
            id: service.id,
            service_name: service.name,
            amount: Number(service.limit_value || 0),
            limit_type: service.limit_type,
            limit_frequency: service.limit_frequency,
            coverage_status: service.coverage_status,
            category_price_limit: categoryPriceLimit,
          })
        }
      }

      let annualLimit = 0
      for (const category of pkg.categories || []) {
        if (category.price_limit !== null && category.price_limit !== undefined) {
          annualLimit += Number(category.price_limit)
        } else {
          for (const service of category.services || []) {
            annualLimit += Number(service.limit_value || 0)
          }
        }
      }

      return {
        id: pkg.id,
        plan_id: pkg.id,
        name: pkg.name,
        plan_tag: pkg.classification,
        classification: pkg.classification,
        description: pkg.description,
        premium_amount: Number(pkg.price || 0),
        annual_limit: annualLimit,
        categories,
        category_limits,
      }
    })

    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    console.error("Client plans fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 })
  }
}
