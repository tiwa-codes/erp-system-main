import * as XLSX from "xlsx"

type ExportPlan = {
  plan_id?: string | number | null
  name: string
  plan_type?: string | null
  classification?: string | null
  premium_amount?: number | string | null
  annual_limit?: number | string | null
  status?: string | null
  approval_stage?: string | null
  created_at?: string | Date | null
  metadata?: Record<string, any> | null
}

type ExportCustomization = {
  categoryName: string
  priceLimit: number | null
  frequencyLimit: number | null
  services: Array<{
    name: string
    facilityPrice: number | null
    servicePriceLimit: number | null
    serviceFrequencyLimit: number | null
  }>
}

function formatNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return ""
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : ""
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function deriveAccountTypePricesFromPlans(
  accountTypes: string[],
  plans: Array<{ individualPrice?: unknown; familyPrice?: unknown }>,
  fallback: Record<string, any>
) {
  const totalIndividual = plans.reduce((sum, item) => sum + Number(item?.individualPrice || 0), 0)
  const totalFamily = plans.reduce((sum, item) => sum + Number(item?.familyPrice || 0), 0)

  return accountTypes.reduce<Record<string, number>>((acc, type) => {
    if (type === "INDIVIDUAL") {
      acc[type] = Number.isFinite(totalIndividual) ? totalIndividual : 0
      return acc
    }
    if (type === "FAMILY") {
      acc[type] = Number.isFinite(totalFamily) ? totalFamily : 0
      return acc
    }

    const fallbackValue = Number(fallback?.[type] || 0)
    acc[type] = Number.isFinite(fallbackValue) ? fallbackValue : 0
    return acc
  }, {})
}

export function buildPlanCustomizationWorkbook(
  plan: ExportPlan,
  customizations: ExportCustomization[]
) {
  const workbook = XLSX.utils.book_new()
  const specialServiceConfig = plan?.metadata?.specialServiceConfig

  if (specialServiceConfig?.enabled) {
    const columns = toStringArray(
      specialServiceConfig.table?.columns?.length
        ? specialServiceConfig.table.columns
        : specialServiceConfig.hospitalTiers
    )
    const aoa: (string | number)[][] = []

    aoa.push(["Crown Jewel HMO"])
    aoa.push([String(plan.name || "Custom Plan")])
    aoa.push([])
    aoa.push(["Account Types"])

    const accountTypes = toStringArray(specialServiceConfig.accountTypes)
    const planColumns = Array.isArray(specialServiceConfig.plans) ? specialServiceConfig.plans : []
    const accountTypePrices = deriveAccountTypePricesFromPlans(
      accountTypes,
      planColumns,
      specialServiceConfig.accountTypePrices || {}
    )
    for (const type of accountTypes) {
      aoa.push([type, Number(accountTypePrices[type] || 0)])
    }

    if (planColumns.length > 0) {
      aoa.push([])
      aoa.push(["Plan Breakdown"])
      aoa.push(["Plan Name", "Individual Price", "Family Price"])
      for (const planColumn of planColumns) {
        aoa.push([
          String(planColumn?.name || ""),
          Number(planColumn?.individualPrice || 0),
          Number(planColumn?.familyPrice || 0),
        ])
      }
    }

    aoa.push([])
    aoa.push(["Region of Cover", specialServiceConfig.regionOfCover || ""])
    aoa.push(["Hospital Tiers", toStringArray(specialServiceConfig.hospitalTiers).join(" + ")])
    aoa.push([
      "Total Annual Limit",
      specialServiceConfig.unlimitedAnnualLimit
        ? "UNLIMITED"
        : Number(specialServiceConfig.totalAnnualLimit || plan.annual_limit || 0),
    ])
    aoa.push([])

    const categories = Array.isArray(specialServiceConfig.table?.categories)
      ? specialServiceConfig.table.categories
      : []
    for (const category of categories) {
      aoa.push([String(category.title || "Category")])
      aoa.push(["Services", ...columns])
      const rows = Array.isArray(category.rows) ? category.rows : []
      if (rows.length === 0) {
        aoa.push(["No services configured"])
      } else {
        for (const row of rows) {
          const rowValues = row && typeof row.values === "object" && row.values !== null ? row.values : {}
          aoa.push([String(row.serviceName || ""), ...columns.map((col: string) => String((rowValues as Record<string, unknown>)[col] ?? ""))])
        }
      }
      aoa.push([])
    }

    const sheet = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(workbook, sheet, "Custom Plan Sheet")
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
  }

  const summaryRows = [
    { Field: "Plan ID", Value: plan.plan_id ?? "" },
    { Field: "Plan Name", Value: plan.name ?? "" },
    { Field: "Plan Type", Value: plan.plan_type ?? "" },
    { Field: "Classification", Value: plan.classification ?? "" },
    { Field: "Premium Amount", Value: formatNumber(plan.premium_amount) },
    { Field: "Annual Limit", Value: formatNumber(plan.annual_limit) },
    { Field: "Status", Value: plan.status ?? "" },
    { Field: "Approval Stage", Value: plan.approval_stage ?? "" },
    {
      Field: "Created Date",
      Value: plan.created_at ? new Date(plan.created_at).toLocaleDateString("en-GB") : "",
    },
  ]

  const categoryRows = customizations.map((category) => ({
    Category: category.categoryName,
    "Category Price Limit": formatNumber(category.priceLimit),
    "Category Frequency Limit": category.frequencyLimit ?? "",
    "Selected Services": category.services.length,
  }))

  const serviceRows = customizations.flatMap((category) =>
    category.services.map((service) => ({
      Category: category.categoryName,
      Service: service.name,
      "Base Price": formatNumber(service.facilityPrice),
      "Service Price Limit": formatNumber(service.servicePriceLimit),
      "Service Frequency Limit": service.serviceFrequencyLimit ?? "",
    }))
  )

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Plan Summary")
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(categoryRows.length > 0 ? categoryRows : [{ Category: "No customized categories" }]),
    "Category Limits"
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(serviceRows.length > 0 ? serviceRows : [{ Service: "No customized services" }]),
    "Services"
  )

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
}
