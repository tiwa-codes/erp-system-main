import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get("providerId")

    if (!providerId) {
      return NextResponse.json(
        { error: "Provider ID is required" },
        { status: 400 }
      )
    }

    // Check if provider has an approved tariff plan
    const approvedTariffPlan = await prisma.tariffPlan.findFirst({
      where: {
        provider_id: providerId,
        status: "APPROVED",
      },
      include: {
        tariff_plan_services: {
          where: {
            status: "ACTIVE",
            is_draft: false,
          },
          orderBy: {
            service_name: "asc",
          },
        },
      },
      orderBy: {
        approved_at: "desc",
      },
    })

    // If no approved tariff plan, return empty array
    if (!approvedTariffPlan) {
      return NextResponse.json({
        success: true,
        services: [],
        message: "No approved tariff plan found for this provider. Services will not be available until tariff plan is approved.",
      })
    }

    return NextResponse.json({
      success: true,
      services: approvedTariffPlan.tariff_plan_services,
      count: approvedTariffPlan.tariff_plan_services.length,
      tariffPlan: {
        id: approvedTariffPlan.id,
        version: approvedTariffPlan.version,
        approved_at: approvedTariffPlan.approved_at,
      },
    })
  } catch (error) {
    console.error("Error fetching provider services:", error)
    return NextResponse.json(
      { error: "Failed to fetch provider services" },
      { status: 500 }
    )
  }
}

