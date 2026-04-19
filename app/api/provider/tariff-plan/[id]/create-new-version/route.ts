import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params

    // Validate ID
    if (!id || id === "null" || id === "undefined") {
      return NextResponse.json(
        { error: "Invalid tariff plan ID" },
        { status: 400 }
      )
    }

    // Get existing tariff plan
    const existingPlan = await prisma.tariffPlan.findUnique({
      where: { id },
      include: {
        provider: true,
        tariff_plan_services: {
          where: {
            status: "ACTIVE",
            is_draft: false,
          },
        },
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

    // Only allow creating new version from APPROVED plans
    if (existingPlan.status !== "APPROVED") {
      return NextResponse.json(
        {
          error: "Can only create new version from approved tariff plans. Current status: " + existingPlan.status,
        },
        { status: 400 }
      )
    }

    // Get the latest version number
    const latestPlan = await prisma.tariffPlan.findFirst({
      where: {
        provider_id: existingPlan.provider_id,
      },
      orderBy: {
        version: "desc",
      },
    })

    const nextVersion = latestPlan ? latestPlan.version + 1 : existingPlan.version + 1

    // Create new tariff plan version as DRAFT
    const newTariffPlan = await prisma.$transaction(async (tx) => {
      // Create new tariff plan
      const newPlan = await tx.tariffPlan.create({
        data: {
          provider_id: existingPlan.provider_id,
          status: "DRAFT",
          version: nextVersion,
        },
      })

      // Copy all services from approved plan to new draft plan
      const newServices = await Promise.all(
        existingPlan.tariff_plan_services.map((service) =>
          tx.tariffPlanService.create({
            data: {
              service_id: service.service_id,
              service_name: service.service_name,
              category_id: service.category_id,
              category_name: service.category_name,
              price: service.price,
              is_primary: service.is_primary,
              is_secondary: service.is_secondary,
              provider_id: service.provider_id,
              tariff_plan_id: newPlan.id,
              is_draft: true, // Mark as draft so they can be edited
              status: "ACTIVE",
            },
          })
        )
      )

      // Create service links
      await Promise.all(
        newServices.map((service) =>
          tx.tariffPlanServiceLink.create({
            data: {
              tariff_plan_id: newPlan.id,
              service_id: service.id,
            },
          })
        )
      )

      return { newPlan, newServices }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "TARIFF_PLAN_CREATE_NEW_VERSION",
        resource: "tariff_plan",
        resource_id: newTariffPlan.newPlan.id,
        old_values: {
          previous_plan_id: id,
          previous_version: existingPlan.version,
        },
        new_values: {
          new_plan_id: newTariffPlan.newPlan.id,
          new_version: nextVersion,
          services_copied: existingPlan.tariff_plan_services.length,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: `New version (v${nextVersion}) created successfully. You can now edit and modify your tariff plan.`,
      tariffPlan: {
        ...newTariffPlan.newPlan,
        _count: {
          tariff_plan_services: newTariffPlan.newServices.length,
        },
      },
    })
  } catch (error) {
    console.error("Error creating new tariff plan version:", error)
    return NextResponse.json(
      { error: "Failed to create new tariff plan version" },
      { status: 500 }
    )
  }
}


