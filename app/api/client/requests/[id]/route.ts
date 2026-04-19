import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildClientPlanOwnerWhere, getClientOwnership } from "@/lib/client-account"

interface ServiceInput {
  category: string
  service_name: string
  amount: number
  quantity?: number
  category_price_limit?: number | string | null
}

function normalizeCurrency(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseOptionalAmount(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === "") return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Amount must be a valid non-negative number")
  }
  return parsed
}

function requireClientRole(role?: string) {
  return role?.toUpperCase() === "GUEST_OR_CLIENT"
}

async function resolveServiceTypes() {
  const serviceTypes = await prisma.serviceType.findMany({
    select: { id: true, service_name: true, service_category: true },
    orderBy: { service_name: "asc" },
  })

  const byName = new Map<string, string>()
  const byCategory = new Map<string, string>()

  for (const service of serviceTypes) {
    byName.set(service.service_name.toLowerCase().trim(), service.id)
    if (!byCategory.has(service.service_category.toLowerCase().trim())) {
      byCategory.set(service.service_category.toLowerCase().trim(), service.id)
    }
  }

  return {
    defaultServiceTypeId: serviceTypes[0]?.id || null,
    byName,
    byCategory,
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!requireClientRole(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const ownership = await getClientOwnership(session.user.id)
    const ownerWhere = buildClientPlanOwnerWhere(ownership)

    if (!ownerWhere) {
      return NextResponse.json({ error: "Client account profile not found" }, { status: 404 })
    }

    const body = await request.json()
    const submit = Boolean(body.submit)
    const services = Array.isArray(body.services) ? (body.services as ServiceInput[]) : []
    let requestedPremium: number | null | undefined
    let requestedAnnualLimit: number | null | undefined

    try {
      requestedPremium = parseOptionalAmount(body.premium_amount)
      requestedAnnualLimit = parseOptionalAmount(body.annual_limit)
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || "Invalid amount supplied" }, { status: 400 })
    }

    const requestPlan = await prisma.clientPlan.findFirst({
      where: {
        id: params.id,
        ...(ownerWhere as any),
      },
    })

    if (!requestPlan) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    if (["INVOICED", "PAID"].includes(requestPlan.status)) {
      return NextResponse.json(
        { error: "This request can no longer be modified after invoice has been raised" },
        { status: 400 }
      )
    }

    if (services.length === 0) {
      return NextResponse.json({ error: "At least one service is required" }, { status: 400 })
    }

    const resolver = await resolveServiceTypes()
    if (!resolver.defaultServiceTypeId) {
      return NextResponse.json({ error: "No service types configured" }, { status: 500 })
    }
    const defaultServiceTypeId = resolver.defaultServiceTypeId

    await prisma.clientPlanService.deleteMany({
      where: { client_plan_id: requestPlan.id },
    })

    await prisma.clientPlanService.createMany({
      data: services.map((service) => {
        const nameKey = String(service.service_name || "").toLowerCase().trim()
        const categoryKey = String(service.category || "").toLowerCase().trim()
        const serviceTypeId =
          resolver.byName.get(nameKey) ||
          resolver.byCategory.get(categoryKey) ||
          defaultServiceTypeId

        const quantity = Number(service.quantity || 1)
        const unitPrice = normalizeCurrency(service.amount)

        return {
          client_plan_id: requestPlan.id,
          service_type_id: serviceTypeId,
          category: String(service.category || "General"),
          service_name: String(service.service_name || "Unnamed Service"),
          quantity,
          unit_price: unitPrice,
          total_amount: quantity * unitPrice,
          frequency_limit: null,
          price_limit: unitPrice,
          category_price_limit:
            service.category_price_limit === null ||
            service.category_price_limit === undefined ||
            service.category_price_limit === ""
              ? null
              : normalizeCurrency(service.category_price_limit),
        }
      }),
    })

    const updated = await prisma.clientPlan.update({
      where: { id: requestPlan.id },
      data: {
        status: submit ? "PENDING" : "DRAFT",
        submitted_at: submit ? new Date() : requestPlan.submitted_at,
        notification_read: false,
        ...(requestedPremium !== undefined && { requested_premium: requestedPremium }),
        ...(requestedAnnualLimit !== undefined && { requested_annual_limit: requestedAnnualLimit }),
      },
      include: {
        services: true,
      },
    })

    return NextResponse.json(
      {
        data: updated,
        message: submit ? "Request submitted successfully" : "Draft updated successfully",
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Client request patch error:", error)
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 })
  }
}
