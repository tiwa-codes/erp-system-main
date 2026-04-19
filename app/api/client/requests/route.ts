import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildClientPlanOwnerWhere, getClientOwnership } from "@/lib/client-account"

interface RequestServiceInput {
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

function computeBenefitPackageAnnualLimit(pkg: any): number {
  let annualLimit = 0
  for (const category of pkg?.categories || []) {
    if (category?.price_limit !== null && category?.price_limit !== undefined) {
      annualLimit += Number(category.price_limit || 0)
      continue
    }
    for (const service of category?.services || []) {
      annualLimit += Number(service?.limit_value || 0)
    }
  }
  return annualLimit
}

function requireClientRole(role?: string) {
  return role?.toUpperCase() === "GUEST_OR_CLIENT"
}

async function getClientPrincipal(userId: string) {
  return getClientOwnership(userId)
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

async function mapServicesToClientPlanServices(services: RequestServiceInput[]) {
  const resolver = await resolveServiceTypes()
  if (!resolver.defaultServiceTypeId) {
    throw new Error("No service types configured")
  }

  const defaultServiceTypeId = resolver.defaultServiceTypeId

  return services.map((service) => {
    const nameKey = service.service_name.toLowerCase().trim()
    const categoryKey = service.category.toLowerCase().trim()

    const serviceTypeId =
      resolver.byName.get(nameKey) ||
      resolver.byCategory.get(categoryKey) ||
      defaultServiceTypeId

    const quantity = Number(service.quantity || 1)
    const unitPrice = normalizeCurrency(service.amount)

    return {
      service_type_id: serviceTypeId,
      category: service.category,
      service_name: service.service_name,
      quantity,
      unit_price: unitPrice,
      total_amount: quantity * unitPrice,
      frequency_limit: null,
      price_limit: unitPrice,
      category_price_limit:
        service.category_price_limit === null || service.category_price_limit === undefined
          ? null
          : normalizeCurrency(service.category_price_limit),
    }
  })
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

    const ownership = await getClientPrincipal(session.user.id)
    const ownerWhere = buildClientPlanOwnerWhere(ownership)
    if (!ownerWhere || !ownership.organizationId) {
      return NextResponse.json({ error: "Client account profile not found" }, { status: 404 })
    }

    const requests = await prisma.clientPlan.findMany({
      where: ownerWhere,
      include: {
        services: true,
        invoice: true,
      },
      orderBy: { created_at: "desc" },
    })

    const data = requests.map((request) => ({
      id: request.id,
      client_plan_id: request.client_plan_id,
      plan_name: request.plan_name,
      plan_description: request.plan_description,
      requested_premium:
        request.requested_premium === null || request.requested_premium === undefined
          ? null
          : Number(request.requested_premium),
      requested_annual_limit:
        request.requested_annual_limit === null || request.requested_annual_limit === undefined
          ? null
          : Number(request.requested_annual_limit),
      status: request.status,
      submitted_at: request.submitted_at,
      created_at: request.created_at,
      updated_at: request.updated_at,
      services: request.services.map((service) => ({
        id: service.id,
        category: service.category,
        service_name: service.service_name,
        quantity: service.quantity,
        amount: Number(service.unit_price || 0),
        total_amount: Number(service.total_amount || 0),
        category_price_limit:
          service.category_price_limit === null || service.category_price_limit === undefined
            ? null
            : Number(service.category_price_limit),
      })),
      invoice: request.invoice
        ? {
            id: request.invoice.id,
            invoice_number: request.invoice.invoice_number,
            total_amount: Number(request.invoice.total_amount || 0),
            status: request.invoice.status,
            due_date: request.invoice.due_date,
            invoice_data: request.invoice.invoice_data,
          }
        : null,
    }))

    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    console.error("Client requests fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!requireClientRole(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const ownership = await getClientPrincipal(session.user.id)
    const ownerWhere = buildClientPlanOwnerWhere(ownership)
    if (!ownerWhere || !ownership.organizationId) {
      return NextResponse.json({ error: "Client account profile not found" }, { status: 404 })
    }

    const body = await request.json()
    const planId = String(body.plan_id || "").trim()
    const submit = Boolean(body.submit)
    let requestedPremium: number | null | undefined
    let requestedAnnualLimit: number | null | undefined

    try {
      requestedPremium = parseOptionalAmount(body.premium_amount)
      requestedAnnualLimit = parseOptionalAmount(body.annual_limit)
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || "Invalid amount supplied" }, { status: 400 })
    }

    if (!planId) {
      return NextResponse.json({ error: "Plan is required" }, { status: 400 })
    }

    const benefitPackage = await prisma.benefitPackage.findUnique({
      where: { id: planId },
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
    })

    // Backward compatibility for any previously rendered legacy plan IDs.
    const legacyPlan = benefitPackage
      ? null
      : await prisma.plan.findUnique({
          where: { id: planId },
          include: {
            package_limits: {
              where: { status: "ACTIVE" },
              orderBy: [{ category: "asc" }, { service_name: "asc" }],
            },
          },
        })

    if (!benefitPackage && !legacyPlan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    const providedServices = Array.isArray(body.services) ? body.services : null
    const sourceServices: RequestServiceInput[] = providedServices
      ? providedServices.map((service: any) => ({
          category: String(service.category || "General"),
          service_name: String(service.service_name || "Unnamed Service"),
          amount: normalizeCurrency(service.amount),
          quantity: Number(service.quantity || 1),
          category_price_limit:
            service.category_price_limit === null || service.category_price_limit === undefined || service.category_price_limit === ""
              ? null
              : normalizeCurrency(service.category_price_limit),
        }))
      : benefitPackage
      ? benefitPackage.categories.flatMap((category: any) =>
          category.services.map((service: any) => ({
            category: category.name,
            service_name: service.name,
            amount: normalizeCurrency(service.limit_value),
            quantity: 1,
            category_price_limit:
              category.price_limit === null || category.price_limit === undefined
                ? null
                : normalizeCurrency(category.price_limit),
          }))
        )
      : (legacyPlan?.package_limits || []).map((limit) => ({
          category: limit.category,
          service_name: limit.service_name || limit.category,
          amount: normalizeCurrency(limit.amount),
          quantity: 1,
          category_price_limit: null,
        }))

    if (sourceServices.length === 0) {
      return NextResponse.json({ error: "No services available for this plan" }, { status: 400 })
    }

    const planServices = await mapServicesToClientPlanServices(sourceServices)

    const defaultPremium = benefitPackage
      ? normalizeCurrency(benefitPackage.price)
      : normalizeCurrency(legacyPlan?.premium_amount)
    const defaultAnnualLimit = benefitPackage
      ? computeBenefitPackageAnnualLimit(benefitPackage)
      : normalizeCurrency(legacyPlan?.annual_limit)

    const created = await prisma.clientPlan.create({
      data: {
        organization_id: ownership.organizationId,
        ...(ownership.clientAccount?.id
          ? { client_account_id: ownership.clientAccount.id }
          : ownership.principal?.id
            ? { principal_account_id: ownership.principal.id }
            : {}),
        plan_name: benefitPackage?.name || legacyPlan?.name || "",
        plan_description: benefitPackage?.description || legacyPlan?.description || null,
        requested_premium: requestedPremium ?? defaultPremium,
        requested_annual_limit: requestedAnnualLimit ?? defaultAnnualLimit,
        status: submit ? "PENDING" : "DRAFT",
        submitted_at: submit ? new Date() : null,
        notification_read: false,
      },
    })

    await prisma.clientPlanService.createMany({
      data: planServices.map((service) => ({
        client_plan_id: created.id,
        ...service,
      })),
    })

    const createdWithServices = await prisma.clientPlan.findUnique({
      where: { id: created.id },
      include: { services: true },
    })

    return NextResponse.json(
      {
        data: createdWithServices,
        message: submit
          ? "Plan request submitted successfully"
          : "Custom draft saved. You can modify and resubmit from Pending Requests.",
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Client request create error:", error)
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 })
  }
}
