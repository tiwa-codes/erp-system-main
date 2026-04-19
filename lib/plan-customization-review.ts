import path from "path"
import fs from "fs/promises"
import { prisma } from "@/lib/prisma"

type PlanLimitLike = {
  category_id: string | null
  service_id: string | null
  limit_type: string
  price_limit: { toString(): string } | number | null
  frequency_limit: number | null
}

type CoveredServiceLike = {
  id: string
  service_type_id: string
  facility_price: { toString(): string } | number
  limit_count: number | null
  service_type?: {
    service_name: string
    service_category: string
  } | null
}

type ReviewPlanLike = {
  plan_limits: PlanLimitLike[]
  covered_services: CoveredServiceLike[]
}

type CustomizationReview = {
  categoryId: string
  categoryName: string
  priceLimit: number | null
  frequencyLimit: number | null
  services: Array<{
    id: string
    name: string
    facilityPrice: number | null
    servicePriceLimit: number | null
    serviceFrequencyLimit: number | null
  }>
}

let cachedCategoryNameById: Map<string, string> | null = null

async function getCategoryNameById() {
  if (cachedCategoryNameById) return cachedCategoryNameById

  const categoryFile = path.join(process.cwd(), "public", "plan_categories.json")
  const raw = await fs.readFile(categoryFile, "utf-8")
  const parsed = JSON.parse(raw) as Array<{ id: string; name: string }>

  cachedCategoryNameById = new Map(parsed.map((entry) => [entry.id, entry.name]))
  return cachedCategoryNameById
}

function toNumber(value: { toString(): string } | number | null | undefined) {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function fallbackCategoryName(categoryId: string) {
  return categoryId
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export async function buildPlanCustomizationReview(plan: ReviewPlanLike): Promise<CustomizationReview[]> {
  const categoryNameById = await getCategoryNameById()
  const categoryMap = new Map<string, CustomizationReview>()
  const serviceMap = new Map<string, { categoryId: string; name: string; facilityPrice: number | null }>()
  const unresolvedServiceIds = new Set<string>()

  const ensureCategory = (categoryId: string, categoryName?: string) => {
    if (!categoryMap.has(categoryId)) {
      categoryMap.set(categoryId, {
        categoryId,
        categoryName: categoryName || categoryNameById.get(categoryId) || fallbackCategoryName(categoryId),
        priceLimit: null,
        frequencyLimit: null,
        services: [],
      })
    }

    return categoryMap.get(categoryId)!
  }

  for (const coveredService of plan.covered_services || []) {
    const categoryName = coveredService.service_type?.service_category?.trim() || "Others"
    const matchedCategoryId =
      [...categoryNameById.entries()].find(([, name]) => name.toLowerCase() === categoryName.toLowerCase())?.[0] ||
      categoryName
    const category = ensureCategory(matchedCategoryId, categoryName)

    const serviceEntry = {
      id: coveredService.service_type_id,
      name: coveredService.service_type?.service_name || coveredService.service_type_id,
      facilityPrice: toNumber(coveredService.facility_price),
      servicePriceLimit: null,
      serviceFrequencyLimit: null,
    }

    category.services.push(serviceEntry)
    serviceMap.set(coveredService.service_type_id, {
      categoryId: matchedCategoryId,
      name: serviceEntry.name,
      facilityPrice: serviceEntry.facilityPrice,
    })
  }

  for (const limit of plan.plan_limits || []) {
    if (!limit.category_id) continue

    const category = ensureCategory(limit.category_id)

    if (limit.service_id === "ALL") {
      if (limit.limit_type === "CATEGORY_PRICE") {
        category.priceLimit = toNumber(limit.price_limit)
      }
      if (limit.limit_type === "CATEGORY_FREQUENCY") {
        category.frequencyLimit = limit.frequency_limit ?? null
      }
      continue
    }

    if (!limit.service_id) continue

    const knownService = serviceMap.get(limit.service_id)
    const serviceCategory = ensureCategory(knownService?.categoryId || limit.category_id)
    let service = serviceCategory.services.find((entry) => entry.id === limit.service_id)

    if (!service) {
      if (!knownService) {
        unresolvedServiceIds.add(limit.service_id)
      }
      service = {
        id: limit.service_id,
        name: knownService?.name || limit.service_id,
        facilityPrice: knownService?.facilityPrice ?? null,
        servicePriceLimit: null,
        serviceFrequencyLimit: null,
      }
      serviceCategory.services.push(service)
    }

    if (limit.limit_type === "SERVICE_PRICE") {
      service.servicePriceLimit = toNumber(limit.price_limit)
    }
    if (limit.limit_type === "SERVICE_FREQUENCY") {
      service.serviceFrequencyLimit = limit.frequency_limit ?? null
    }
  }

  if (unresolvedServiceIds.size > 0) {
    const unresolvedValues = [...unresolvedServiceIds]
    const serviceTypes = await prisma.serviceType.findMany({
      where: {
        OR: [
          { id: { in: unresolvedValues } },
          { service_id: { in: unresolvedValues } },
        ],
      },
      select: {
        id: true,
        service_id: true,
        service_name: true,
        service_category: true,
      },
    })

    const resolvedByAnyId = new Map<string, { id: string; service_name: string; service_category: string }>()
    for (const serviceType of serviceTypes) {
      resolvedByAnyId.set(serviceType.id, serviceType)
      resolvedByAnyId.set(serviceType.service_id, serviceType)
    }

    for (const category of categoryMap.values()) {
      category.services = category.services.map((service) => {
        const resolved = resolvedByAnyId.get(service.id)
        if (!resolved) return service

        const mappedCategoryId =
          [...categoryNameById.entries()].find(([, name]) => name.toLowerCase() === resolved.service_category.toLowerCase())?.[0] ||
          resolved.service_category

        serviceMap.set(resolved.id, {
          categoryId: mappedCategoryId,
          name: resolved.service_name,
          facilityPrice: service.facilityPrice,
        })

        return {
          ...service,
          id: resolved.id,
          name: resolved.service_name,
        }
      })
    }
  }

  return Array.from(categoryMap.values())
    .map((category) => ({
      ...category,
      services: category.services.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
}
