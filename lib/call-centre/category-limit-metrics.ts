import { prisma } from "@/lib/prisma"
import fs from "fs/promises"
import path from "path"

type AnyService = Record<string, any>

export type ServiceWithCategoryMetrics<T extends AnyService> = T & {
  category_price_limit: number | null
  category_frequency_limit: number | null
  category_used_amount: number
  category_used_frequency: number
  category_balance_amount: number | null
  category_balance_frequency: number | null
}

export type CategoryLimitAvailability = {
  isBlocked: boolean
  reason: string | null
  coverageStatus: "COVERED" | "LIMIT_EXCEEDED"
}

const ACTIVE_CODE_STATUSES = ["APPROVED", "PARTIAL"] as const

function toNumber(value: any): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function getCategoryLimitAvailability(service: {
  price?: number | null
  amount?: number | null
  facility_price?: number | null
  category_price_limit?: number | null
  category_frequency_limit?: number | null
  category_balance_amount?: number | null
  category_balance_frequency?: number | null
}): CategoryLimitAvailability {
  const serviceAmount = toNumber(service.price ?? service.amount ?? service.facility_price ?? 0)
  const balanceAmount = service.category_balance_amount ?? null
  const balanceFrequency = service.category_balance_frequency ?? null
  const hasCategoryPriceLimit = service.category_price_limit != null
  const hasCategoryFrequencyLimit = service.category_frequency_limit != null

  if (hasCategoryPriceLimit && balanceAmount !== null) {
    if (balanceAmount <= 0) {
      return {
        isBlocked: true,
        coverageStatus: "LIMIT_EXCEEDED",
        reason: "Category price limit has been exhausted for this enrollee."
      }
    }

    if (serviceAmount > balanceAmount) {
      return {
        isBlocked: true,
        coverageStatus: "LIMIT_EXCEEDED",
        reason: `Service price (N${serviceAmount.toLocaleString()}) exceeds the remaining category balance (N${balanceAmount.toLocaleString()}).`
      }
    }
  }

  if (hasCategoryFrequencyLimit && balanceFrequency !== null && balanceFrequency <= 0) {
    return {
      isBlocked: true,
      coverageStatus: "LIMIT_EXCEEDED",
      reason: "Category frequency limit has been exhausted for this enrollee."
    }
  }

  return {
    isBlocked: false,
    coverageStatus: "COVERED",
    reason: null
  }
}

function normalizeCategory(category?: string | null): string {
  return (category || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function categoriesMatch(source?: string | null, target?: string | null): boolean {
  const sourceNorm = normalizeCategory(source)
  const targetNorm = normalizeCategory(target)
  if (!sourceNorm || !targetNorm) return false
  if (sourceNorm === targetNorm) return true
  return sourceNorm.includes(targetNorm) || targetNorm.includes(sourceNorm)
}

function prettyCategory(category?: string | null): string {
  const raw = (category || "").trim()
  if (!raw) return ""

  const upper = raw.toUpperCase()
  if (upper === "DRG") return "Drugs / Pharmaceuticals"
  if (upper === "SER") return "Medical Services"

  return raw
}

function getServiceCategory(service: AnyService): string {
  return prettyCategory(
    service.service_category ||
      service.category_name ||
      service.category ||
      null
  )
}

function parseFrequency(value?: string | null): number | null {
  if (!value) return null
  const match = value.match(/\d+/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

async function resolvePrincipalContext(enrolleeIdentifier: string) {
  const principal = await prisma.principalAccount.findFirst({
    where: {
      OR: [{ id: enrolleeIdentifier }, { enrollee_id: enrolleeIdentifier }],
    },
    select: {
      id: true,
      plan_id: true,
    },
  })

  if (principal?.plan_id) {
    return { principalId: principal.id, planId: principal.plan_id }
  }

  const dependent = await prisma.dependent.findFirst({
    where: {
      OR: [{ id: enrolleeIdentifier }, { dependent_id: enrolleeIdentifier }],
    },
    select: {
      principal_id: true,
      principal: {
        select: {
          id: true,
          plan_id: true,
        },
      },
    },
  })

  if (dependent?.principal?.plan_id) {
    return {
      principalId: dependent.principal.id,
      planId: dependent.principal.plan_id,
    }
  }

  return null
}

function extractServicesJson(value: string): any[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function getPlanCategoryIdNameMap(): Promise<Map<string, string>> {
  try {
    const categoriesPath = path.join(process.cwd(), "public", "plan_categories.json")
    const categoriesRaw = await fs.readFile(categoriesPath, "utf-8")
    const categories = JSON.parse(categoriesRaw) as Array<{ id: string; name: string }>
    const idToName = new Map<string, string>()
    for (const category of categories) {
      idToName.set(String(category.id), category.name)
    }
    return idToName
  } catch {
    return new Map<string, string>()
  }
}

export async function withCategoryLimitMetrics<T extends AnyService>(
  services: T[],
  enrolleeIdentifier?: string | null
): Promise<ServiceWithCategoryMetrics<T>[]> {
  if (!services.length || !enrolleeIdentifier) {
    return services.map((service) => ({
      ...service,
      category_price_limit: null,
      category_frequency_limit: null,
      category_used_amount: 0,
      category_used_frequency: 0,
      category_balance_amount: null,
      category_balance_frequency: null,
    }))
  }

  const context = await resolvePrincipalContext(enrolleeIdentifier)
  if (!context) {
    return services.map((service) => ({
      ...service,
      category_price_limit: null,
      category_frequency_limit: null,
      category_used_amount: 0,
      category_used_frequency: 0,
      category_balance_amount: null,
      category_balance_frequency: null,
    }))
  }

  const categories = Array.from(
    new Set(
      services
        .map((service) => getServiceCategory(service))
        .filter((category) => category.length > 0)
    )
  )
  const categoryKeys = new Set(categories.map((category) => normalizeCategory(category)))

  const [packageLimits, planLimits, priorCodes, planCategoryMap] = await Promise.all([
    prisma.packageLimit.findMany({
      where: {
        plan_id: context.planId,
        status: "ACTIVE",
      },
      select: {
        category: true,
        service_name: true,
        amount: true,
        limit_type: true,
        limit_frequency: true,
        coverage_status: true,
      },
    }),
    prisma.planLimit.findMany({
      where: {
        plan_id: context.planId,
        limit_type: { in: ["CATEGORY_PRICE", "CATEGORY_FREQUENCY"] },
      },
      select: {
        category_id: true,
        service_id: true,
        limit_type: true,
        price_limit: true,
        frequency_limit: true,
      },
    }),
    prisma.approvalCode.findMany({
      where: {
        enrollee_id: context.principalId,
        is_deleted: false,
        status: { in: ACTIVE_CODE_STATUSES as any },
      },
      select: {
        services: true,
      },
      orderBy: {
        created_at: "desc",
      },
      take: 500,
    }),
    getPlanCategoryIdNameMap(),
  ])

  const serviceNameCategoryMap = new Map<string, string>()
  for (const service of services) {
    const name = String(service.service_name || service.name || "").trim().toLowerCase()
    const category = getServiceCategory(service)
    if (name && category) {
      serviceNameCategoryMap.set(name, category)
    }
  }

  const usageByCategory = new Map<string, { usedAmount: number; usedFrequency: number }>()
  for (const code of priorCodes) {
    const codeServices = extractServicesJson(code.services || "")
    for (const item of codeServices) {
      if (item?.is_approved === false) continue
      const coverage = String(item?.coverage || item?.coverage_status || "").toUpperCase()
      if (coverage === "REJECTED" || coverage === "NOT_COVERED") continue

      const resolvedCategory =
        prettyCategory(item?.service_category || item?.category_name || item?.category) ||
        serviceNameCategoryMap.get(String(item?.service_name || item?.name || "").trim().toLowerCase()) ||
        ""

      const categoryKey = normalizeCategory(resolvedCategory)
      if (!categoryKey || !categoryKeys.has(categoryKey)) continue

      const qty = Math.max(1, Math.floor(toNumber(item?.quantity || 1)))
      const lineAmount = item?.vetted_amount != null
        ? toNumber(item.vetted_amount)
        : toNumber(item?.amount ?? item?.service_amount ?? item?.final_price) * qty

      const existing = usageByCategory.get(categoryKey) || { usedAmount: 0, usedFrequency: 0 }
      existing.usedAmount += lineAmount
      existing.usedFrequency += qty
      usageByCategory.set(categoryKey, existing)
    }
  }

  const limitByCategory = new Map<string, { priceLimit: number | null; frequencyLimit: number | null }>()

  for (const category of categories) {
    const categoryKey = normalizeCategory(category)
    let priceLimit: number | null = null
    let frequencyLimit: number | null = null

    const packageCandidates = packageLimits.filter((limit) => {
      if (String(limit.coverage_status) === "NOT_COVERED") return false
      return normalizeCategory(limit.category) === categoryKey
    })

    const packagePrice = packageCandidates.find((limit) => limit.limit_type === "PRICE" && !limit.service_name)
      || packageCandidates.find((limit) => limit.limit_type === "PRICE")
    if (packagePrice) {
      priceLimit = toNumber(packagePrice.amount)
    }

    const packageFrequency = packageCandidates.find((limit) => limit.limit_type === "FREQUENCY" && !limit.service_name)
      || packageCandidates.find((limit) => limit.limit_type === "FREQUENCY")
    if (packageFrequency) {
      frequencyLimit = parseFrequency(packageFrequency.limit_frequency) ?? toNumber(packageFrequency.amount)
    }

    const planCandidates = planLimits.filter((limit) => {
      if (limit.service_id && limit.service_id !== "ALL") return false
      const categoryFromId = limit.category_id ? planCategoryMap.get(String(limit.category_id)) : null
      return (
        categoriesMatch(limit.category_id, category) ||
        categoriesMatch(categoryFromId, category) ||
        normalizeCategory(limit.category_id || "") === categoryKey
      )
    })

    const planPrice = planCandidates.find((limit) => limit.limit_type === "CATEGORY_PRICE" && limit.price_limit != null)
    if (planPrice?.price_limit != null) {
      priceLimit = toNumber(planPrice.price_limit)
    }

    const planFrequency = planCandidates.find((limit) => limit.limit_type === "CATEGORY_FREQUENCY" && limit.frequency_limit != null)
    if (planFrequency?.frequency_limit != null) {
      frequencyLimit = toNumber(planFrequency.frequency_limit)
    }

    limitByCategory.set(categoryKey, { priceLimit, frequencyLimit })
  }

  return services.map((service) => {
    const category = getServiceCategory(service)
    const categoryKey = normalizeCategory(category)
    const usage = usageByCategory.get(categoryKey) || { usedAmount: 0, usedFrequency: 0 }
    const limits = limitByCategory.get(categoryKey) || { priceLimit: null, frequencyLimit: null }
    const balanceAmount = limits.priceLimit != null ? Math.max(0, limits.priceLimit - usage.usedAmount) : null
    const balanceFrequency =
      limits.frequencyLimit != null ? Math.max(0, limits.frequencyLimit - usage.usedFrequency) : null

    return {
      ...service,
      category_price_limit: limits.priceLimit,
      category_frequency_limit: limits.frequencyLimit,
      category_used_amount: usage.usedAmount,
      category_used_frequency: usage.usedFrequency,
      category_balance_amount: balanceAmount,
      category_balance_frequency: balanceFrequency,
    }
  })
}
