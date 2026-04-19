import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

interface DraftServiceInput {
  service_type_id: string
  category?: string
  service_name: string
  quantity?: number
  unit_price: number
  frequency_limit?: number | null
  price_limit?: number | null
  category_price_limit?: number | string | null
}

/**
 * POST /api/clients-plans/save-draft
 * Mobile app: Save/update draft client plan with services
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const {
      planName,
      planDescription,
      services,
    }: { planName: string; planDescription?: string; services?: DraftServiceInput[] } = await req.json()

    // Get the principal account for this user
    const principalAccount = await prisma.principalAccount.findUnique({
      where: { user_id: session.user.id },
    })

    if (!principalAccount) {
      return NextResponse.json(
        { error: "Principal account not found" },
        { status: 404 }
      )
    }

    // Check if draft already exists for this organization + principal
    let clientPlan = await prisma.clientPlan.findFirst({
      where: {
        principal_account_id: principalAccount.id,
        status: "DRAFT",
      },
      include: { services: true },
    })

    if (clientPlan) {
      // Update existing draft
      clientPlan = await prisma.clientPlan.update({
        where: { id: clientPlan.id },
        data: {
          plan_name: planName,
          plan_description: planDescription,
          updated_at: new Date(),
        },
        include: { services: true },
      })

      // Delete old services and add new ones
      await prisma.clientPlanService.deleteMany({
        where: { client_plan_id: clientPlan.id },
      })
    } else {
      // Create new draft plan
      clientPlan = await prisma.clientPlan.create({
        data: {
          plan_name: planName,
          plan_description: planDescription,
          organization_id: principalAccount.organization_id,
          principal_account_id: principalAccount.id,
          status: "DRAFT",
        },
        include: { services: true },
      })
    }

    // Add services to the plan
    if (services && services.length > 0) {
      const createdServices = await Promise.all(
        services.map((service) =>
          prisma.clientPlanService.create({
            data: {
              client_plan_id: clientPlan.id,
              service_type_id: service.service_type_id,
              category: service.category ?? service.service_name,
              service_name: service.service_name,
              quantity: service.quantity || 1,
              unit_price: service.unit_price,
              total_amount: (service.quantity || 1) * service.unit_price,
              frequency_limit: service.frequency_limit,
              price_limit: service.price_limit,
              category_price_limit:
                service.category_price_limit === null ||
                service.category_price_limit === undefined ||
                service.category_price_limit === ""
                  ? null
                  : Number(service.category_price_limit),
            },
          })
        )
      )
      clientPlan.services = createdServices
    }

    return NextResponse.json(
      {
        data: clientPlan,
        message: "Draft plan saved successfully",
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error saving draft:", error)
    return NextResponse.json(
      { error: "Failed to save draft plan" },
      { status: 500 }
    )
  }
}
