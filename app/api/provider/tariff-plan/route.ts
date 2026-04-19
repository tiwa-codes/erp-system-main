import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const tariffPlanSchema = z.object({
  provider_id: z.string().min(1, "Provider ID is required"),
  version: z.number().optional(),
})

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

    // Check if user has permission to manage tariff plans
    const hasPermission = await checkPermission(session.user.role as any, "provider", "manage_tariff_plan")
    
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // If user has permission, they can access the tariff plan
    // PROVIDER role users can select any provider from the UI
    // Other roles (PROVIDER_MANAGER, ADMIN) can also access any provider's tariff plan

    // Get the current tariff plan (latest version)
    const tariffPlan = await prisma.tariffPlan.findFirst({
      where: {
        provider_id: providerId,
      },
      include: {
        provider: {
          select: {
            id: true,
            facility_name: true,
            email: true,
          },
        },
        approved_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        tariff_plan_services: true,
        _count: {
          select: {
            tariff_plan_services: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    })

    if (!tariffPlan) {
      // Return a default draft tariff plan structure
      return NextResponse.json({
        success: true,
        tariffPlan: {
          id: null,
          provider_id: providerId,
          status: "DRAFT",
          version: 1,
          submitted_at: null,
          approved_at: null,
          approved_by_id: null,
          rejection_reason: null,
          created_at: new Date(),
          updated_at: new Date(),
          tariff_plan_services: [],
          _count: {
            tariff_plan_services: 0,
          },
        },
      })
    }

    return NextResponse.json({
      success: true,
      tariffPlan,
    })
  } catch (error) {
    console.error("Error fetching tariff plan:", error)
    return NextResponse.json(
      { error: "Failed to fetch tariff plan" },
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

    const hasPermission = await checkPermission(session.user.role as any, "provider", "manage_tariff_plan")
    
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { provider_id } = body

    // If user has permission, they can create tariff plans for any provider
    // PROVIDER role users can select any provider from the UI

    const validatedData = tariffPlanSchema.parse(body)

    // Check if provider exists
    const provider = await prisma.provider.findUnique({
      where: { id: validatedData.provider_id },
    })

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      )
    }

    // Get the latest version number
    const latestPlan = await prisma.tariffPlan.findFirst({
      where: {
        provider_id: validatedData.provider_id,
      },
      orderBy: {
        version: "desc",
      },
    })

    const nextVersion = latestPlan ? latestPlan.version + 1 : 1

    // Create new tariff plan
    const tariffPlan = await prisma.tariffPlan.create({
      data: {
        provider_id: validatedData.provider_id,
        status: "DRAFT",
        version: nextVersion,
      },
      include: {
        provider: {
          select: {
            id: true,
            facility_name: true,
            email: true,
          },
        },
        _count: {
          select: {
            tariff_plan_services: true,
          },
        },
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "TARIFF_PLAN_CREATE",
        resource: "tariff_plan",
        resource_id: tariffPlan.id,
        new_values: tariffPlan,
      },
    })

    return NextResponse.json(
      {
        success: true,
        tariffPlan,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating tariff plan:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.errors,
        },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to create tariff plan" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: "Tariff plan ID is required" },
        { status: 400 }
      )
    }

    // Get existing tariff plan
    const existingPlan = await prisma.tariffPlan.findUnique({
      where: { id },
      include: {
        provider: true,
      },
    })

    if (!existingPlan) {
      return NextResponse.json(
        { error: "Tariff plan not found" },
        { status: 404 }
      )
    }

    // Check permissions
    const hasPermission = await checkPermission(session.user.role as any, "provider", "manage_tariff_plan")
    const isProviderUser = session.user.provider_id === existingPlan.provider_id

    if (!hasPermission && !isProviderUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Only allow updates if status is DRAFT or REJECTED
    if (existingPlan.status !== "DRAFT" && existingPlan.status !== "REJECTED") {
      return NextResponse.json(
        {
          error: "Cannot update tariff plan. Status must be DRAFT or REJECTED",
        },
        { status: 400 }
      )
    }

    // Update tariff plan
    const updatedPlan = await prisma.tariffPlan.update({
      where: { id },
      data: {
        ...updateData,
        // Reset rejection reason if updating from REJECTED
        ...(existingPlan.status === "REJECTED" && { rejection_reason: null }),
      },
      include: {
        provider: {
          select: {
            id: true,
            facility_name: true,
            email: true,
          },
        },
        _count: {
          select: {
            tariff_plan_services: true,
          },
        },
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "TARIFF_PLAN_UPDATE",
        resource: "tariff_plan",
        resource_id: id,
        old_values: existingPlan,
        new_values: updatedPlan,
      },
    })

    return NextResponse.json({
      success: true,
      tariffPlan: updatedPlan,
    })
  } catch (error) {
    console.error("Error updating tariff plan:", error)
    return NextResponse.json(
      { error: "Failed to update tariff plan" },
      { status: 500 }
    )
  }
}

