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

    // Check if user has provider permissions
    const hasPermission = await checkPermission(session.user.role as any, "provider", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const bandLabels = searchParams.get("bands")?.split(",") || []
    const planId = searchParams.get("plan_id")

    // If plan_id is provided, get providers accessible to that plan
    if (planId) {
      const plan = await prisma.plan.findUnique({
        where: { id: planId },
        select: { assigned_bands: true }
      })

      if (!plan) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 })
      }

      // Get providers that have bands matching the plan's assigned bands
      const providers = await prisma.provider.findMany({
        where: {
          status: "ACTIVE",
          selected_bands: {
            hasSome: plan.assigned_bands
          }
        },
        select: {
          id: true,
          provider_id: true,
          facility_name: true,
          address: true,
          phone_whatsapp: true,
          email: true,
          practice: true,
          selected_bands: true,
          status: true
        },
        orderBy: {
          facility_name: "asc"
        }
      })

      return NextResponse.json({
        success: true,
        providers
      })
    }

    // If specific band labels are provided, filter by those
    if (bandLabels.length > 0) {
      const providers = await prisma.provider.findMany({
        where: {
          status: "ACTIVE",
          selected_bands: {
            hasSome: bandLabels
          }
        },
        select: {
          id: true,
          provider_id: true,
          facility_name: true,
          address: true,
          phone_whatsapp: true,
          email: true,
          practice: true,
          selected_bands: true,
          status: true
        },
        orderBy: {
          facility_name: "asc"
        }
      })

      return NextResponse.json({
        success: true,
        providers
      })
    }

    // Return all active providers
    const providers = await prisma.provider.findMany({
      where: {
        status: "ACTIVE"
      },
      select: {
        id: true,
        provider_id: true,
        facility_name: true,
        address: true,
        phone_whatsapp: true,
        email: true,
        practice: true,
        selected_bands: true,
        status: true
      },
      orderBy: {
        facility_name: "asc"
      }
    })

    return NextResponse.json({
      success: true,
      providers
    })

  } catch (error) {
    console.error("Error fetching providers by band:", error)
    return NextResponse.json(
      { error: "Failed to fetch providers" },
      { status: 500 }
    )
  }
}
