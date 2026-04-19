import type { Plan, PlanLimit } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { USABLE_CLAIM_STATUSES } from "@/lib/underwriting/enforcement"

export interface PlanUsageSummary {
  planId: string
  planName: string
  planType: string
  status: string
  annualLimit: number
  totalUsed: number
  remaining: number
  utilization: number
  limitBreached: boolean
  warnings: string[]
  planLimits: PlanLimit[]
  premiumAmount: number
  claimPremiumRatio: number
}

export interface OrganizationLiabilitySummary {
  organizationId: string
  name: string
  code?: string
  totalAnnualLimit: number
  totalUsed: number
  utilization: number
  limitBreaches: boolean
  planCount: number
  plans: PlanUsageSummary[]
  totalPremium: number
  claimPremiumRatio: number
  premiumPaid: number // Amount the organization paid to the HMO
  liability: number // Total amount all enrollees are eligible to (Plan Premium × Enrollee Count)
  balance: number // Premium Paid - Utilized
}

export interface UtilizationReportOptions {
  planStatus?: string[]
  limitBreaches?: boolean
  from?: string
  to?: string
  organizationId?: string
  page?: number
  limit?: number
}

export interface UtilizationReportResult {
  organizations: OrganizationLiabilitySummary[]
  organizationOptions: Array<{
    id: string
    name: string
    code: string | null
  }>
  pagination: {
    page: number
    limit: number
    total: number
  }
}

const buildDateRange = (from?: string, to?: string) => {
  const range: { gte?: Date; lte?: Date } = {}

  if (from) {
    const parsed = new Date(from)
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0)
      range.gte = parsed
    }
  }

  if (to) {
    const parsed = new Date(to)
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(23, 59, 59, 999)
      range.lte = parsed
    }
  }

  return Object.keys(range).length > 0 ? range : undefined
}

const calculatePlanUsage = async (
  plan: Plan & { plan_limits: PlanLimit[] },
  options?: { from?: string; to?: string; includeCarryForward?: boolean }
): Promise<PlanUsageSummary> => {
  const claimsWhere: any = {
    principal: {
      plan_id: plan.id,
    },
    status: {
      in: USABLE_CLAIM_STATUSES,
    },
  }

  const dateRange = buildDateRange(options?.from, options?.to)
  if (dateRange) {
    claimsWhere.created_at = dateRange
  }

  const usageAggregate = await prisma.claim.aggregate({
    _sum: {
      amount: true,
    },
    where: claimsWhere,
  })

  // Also include unused but approved codes for more accurate utilization
  const unusedCodesWhere: any = {
    enrollee: {
      plan_id: plan.id
    },
    status: 'APPROVED',
    claim_id: null,
    is_deleted: false,
  }

  if (dateRange) {
    unusedCodesWhere.created_at = dateRange
  }

  const unusedCodesAggregate = await prisma.approvalCode.aggregate({
    _sum: {
      amount: true,
    },
    where: unusedCodesWhere
  })

  let carryForwardUsed = 0
  if (options?.includeCarryForward !== false) {
    const [principalCarryForward, dependentCarryForward] = await Promise.all([
      prisma.principalAccount.aggregate({
        _sum: {
          old_utilization: true,
        },
        where: {
          plan_id: plan.id,
        },
      }),
      prisma.dependent.aggregate({
        _sum: {
          old_utilization: true,
        },
        where: {
          principal: {
            plan_id: plan.id,
          },
        },
      }),
    ])

    carryForwardUsed =
      Number(principalCarryForward._sum.old_utilization ?? 0) +
      Number(dependentCarryForward._sum.old_utilization ?? 0)
  }
  const totalUsed =
    Number(usageAggregate._sum.amount ?? 0) +
    Number(unusedCodesAggregate._sum.amount ?? 0) +
    carryForwardUsed
  const annualLimit = Number(plan.annual_limit ?? 0)
  const premiumAmount = Number(plan.premium_amount ?? 0)
  const utilization =
    annualLimit > 0 ? Number(((totalUsed / annualLimit) * 100).toFixed(2)) : 0
  const remaining = Math.max(0, annualLimit - totalUsed)
  const limitBreached = annualLimit > 0 && totalUsed > annualLimit
  const claimPremiumRatio =
    premiumAmount > 0 ? Number(((totalUsed / premiumAmount) * 100).toFixed(2)) : 0

  const warnings: string[] = []
  if (plan.status !== "COMPLETE") {
    warnings.push(`Plan is ${plan.status} and cannot be used for new claims yet.`)
  }

  if (limitBreached) {
    warnings.push("Plan annual limit has been exceeded.")
  }

  return {
    planId: plan.id,
    planName: plan.name,
    planType: plan.plan_type,
    status: plan.status,
    annualLimit,
    totalUsed,
    remaining,
    utilization: Number(utilization.toFixed(2)),
    limitBreached,
    warnings,
    planLimits: plan.plan_limits ?? [],
    premiumAmount,
    claimPremiumRatio,
  }
}

export async function getOrganizationLiability(
  organizationId: string,
  options?: {
    planStatusFilter?: string[]
    from?: string
    to?: string
    includeCarryForward?: boolean
  }
): Promise<OrganizationLiabilitySummary> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      organization_plans: {
        include: {
          plan: {
            include: {
              plan_limits: true,
            },
          },
        },
      },
      plans: {
        include: { plan_limits: true },
        orderBy: { created_at: "desc" },
      },
      principal_accounts: {
        select: {
          id: true,
          enrollee_id: true,
          plan_id: true,
          old_utilization: true,
          dependents: {
            select: {
              id: true,
              dependent_id: true,
              old_utilization: true,
            },
          },
        },
      },
    },
  })

  if (!organization) {
    throw new Error("Organization not found")
  }

  // Plans are primarily attached via organization_plans. Keep direct plans as fallback for legacy records.
  const plansById = new Map<string, Plan & { plan_limits: PlanLimit[] }>()
  for (const link of organization.organization_plans) {
    if (link.plan) {
      plansById.set(link.plan.id, link.plan as Plan & { plan_limits: PlanLimit[] })
    }
  }
  for (const directPlan of organization.plans) {
    plansById.set(directPlan.id, directPlan as Plan & { plan_limits: PlanLimit[] })
  }
  const attachedPlans = Array.from(plansById.values())

  const planSummaries = await Promise.all(
    attachedPlans.map((plan) =>
      calculatePlanUsage(plan, {
        from: options?.from,
        to: options?.to,
        includeCarryForward: options?.includeCarryForward,
      })
    )
  )

  const filteredPlans = options?.planStatusFilter?.length
    ? planSummaries.filter((plan) =>
        options.planStatusFilter?.includes(plan.status)
      )
    : planSummaries

  const totalAnnualLimitFromPlans = filteredPlans.reduce(
    (sum, plan) => sum + plan.annualLimit,
    0
  )
  const totalPremium = filteredPlans.reduce(
    (sum, plan) => sum + plan.premiumAmount,
    0
  )
  const filteredPlanIds = new Set(filteredPlans.map((plan) => plan.planId))

  const relevantPrincipals = options?.planStatusFilter?.length
    ? organization.principal_accounts.filter(
        (principal) => !!principal.plan_id && filteredPlanIds.has(principal.plan_id)
      )
    : organization.principal_accounts

  const enrolleeIds = [
    ...relevantPrincipals.map((principal) => principal.enrollee_id),
    ...relevantPrincipals.flatMap((principal) =>
      principal.dependents.map((dependent) => dependent.dependent_id)
    ),
  ]

  const dateRange = buildDateRange(options?.from, options?.to)

  const claimsWhere: any = {
    enrollee_id: { in: enrolleeIds },
    status: { in: USABLE_CLAIM_STATUSES },
  }
  if (dateRange) {
    claimsWhere.created_at = dateRange
  }

  const codesWhere: any = {
    enrollee_id: { in: enrolleeIds },
    status: "APPROVED",
    is_deleted: false,
    claim_id: null,
  }
  if (dateRange) {
    codesWhere.created_at = dateRange
  }

  const [claimsUsage, codeUsage] = await Promise.all([
    enrolleeIds.length
      ? prisma.claim.aggregate({
          _sum: { amount: true },
          where: claimsWhere,
        })
      : Promise.resolve({ _sum: { amount: 0 } } as any),
    enrolleeIds.length
      ? prisma.approvalCode.aggregate({
          _sum: { amount: true },
          where: codesWhere,
        })
      : Promise.resolve({ _sum: { amount: 0 } } as any),
  ])

  const carryForwardUsed = options?.includeCarryForward === false
    ? 0
    : relevantPrincipals.reduce(
        (sum, principal) => sum + Number(principal.old_utilization ?? 0),
        0
      ) +
      relevantPrincipals.reduce(
        (sum, principal) =>
          sum +
          principal.dependents.reduce(
            (depSum, dependent) => depSum + Number(dependent.old_utilization ?? 0),
            0
          ),
        0
      )

  const totalUsed =
    Number(claimsUsage._sum.amount ?? 0) +
    Number(codeUsage._sum.amount ?? 0) +
    carryForwardUsed

  // Total limit/liability is based on plan annual limit x number of enrollees on each plan.
  const totalLimit = relevantPrincipals.reduce((sum, principal) => {
    const principalPlan = principal.plan_id ? plansById.get(principal.plan_id) : null
    const planLimit = Number(principalPlan?.annual_limit ?? 0)
    const enrolleeCountOnPrincipal = 1 + principal.dependents.length
    return sum + (planLimit * enrolleeCountOnPrincipal)
  }, 0)

  const utilization =
    totalLimit > 0
      ? Number(((totalUsed / totalLimit) * 100).toFixed(2))
      : 0

  // Premium paid comes from organization setup (create/edit). Default to zero if not set.
  const premiumPaid = Number(organization.premium_paid ?? 0)

  // Liability is strictly max exposure from limits (plan limit × total enrollees).
  const liability = totalLimit

  // Balance is remaining available limit after utilization.
  const balance = totalLimit - totalUsed

  // Calculate Claims/Premium ratio: Utilized / Premium Paid
  const claimPremiumRatio =
    premiumPaid > 0
      ? Number(((totalUsed / premiumPaid) * 100).toFixed(2))
      : 0

  return {
    organizationId: organization.id,
    name: organization.name,
    code: organization.code,
    totalAnnualLimit: totalLimit || totalAnnualLimitFromPlans,
    totalUsed,
    utilization,
    limitBreaches: totalLimit > 0 ? totalUsed > totalLimit : filteredPlans.some((plan) => plan.limitBreached),
    planCount: attachedPlans.length,
    plans: filteredPlans,
    totalPremium,
    claimPremiumRatio,
    premiumPaid,
    liability,
    balance,
  }
}

export async function getUtilizationReport(
  options?: UtilizationReportOptions
): Promise<UtilizationReportResult> {
  const page = options?.page && options.page > 0 ? options.page : 1
  const limit = options?.limit && options.limit > 0 ? options.limit : 20
  const includeCarryForward = !(options?.from || options?.to)
  const where = options?.organizationId ? { id: options.organizationId } : undefined

  const [scopedOrganizations, organizationOptions] = await Promise.all([
    prisma.organization.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
      },
    }),
    prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
      },
    }),
  ])

  const summaries = await Promise.all(
    scopedOrganizations.map((organization) =>
      getOrganizationLiability(organization.id, {
        planStatusFilter: options?.planStatus,
        from: options?.from,
        to: options?.to,
        includeCarryForward,
      })
    )
  )

  const filteredByLimitBreach = typeof options?.limitBreaches === "boolean"
    ? summaries.filter((summary) =>
        options.limitBreaches ? summary.limitBreaches : !summary.limitBreaches
      )
    : summaries

  const total = filteredByLimitBreach.length
  const startIndex = (page - 1) * limit

  return {
    organizations: filteredByLimitBreach.slice(startIndex, startIndex + limit),
    organizationOptions,
    pagination: {
      page,
      limit,
      total,
    },
  }
}

export async function getEnrolleeUtilization(principalIdOrIdentifier: string) {
  let principal = await prisma.principalAccount.findUnique({
    where: { id: principalIdOrIdentifier },
    select: {
      id: true,
      enrollee_id: true,
      start_date: true,
      end_date: true,
      plan: {
        select: {
          annual_limit: true
        }
      },
      old_utilization: true,
    }
  })

  if (!principal) {
    principal = await prisma.principalAccount.findFirst({
      where: { enrollee_id: principalIdOrIdentifier },
      select: {
        id: true,
        enrollee_id: true,
        start_date: true,
        end_date: true,
        plan: {
          select: {
            annual_limit: true
          }
        },
        old_utilization: true,
      }
    })
  }

  if (!principal) {
    const dependent = await prisma.dependent.findFirst({
      where: {
        OR: [
          { id: principalIdOrIdentifier },
          { dependent_id: principalIdOrIdentifier }
        ]
      },
      select: { principal_id: true }
    })
    if (dependent?.principal_id) {
      principal = await prisma.principalAccount.findUnique({
        where: { id: dependent.principal_id },
        select: {
          id: true,
          enrollee_id: true,
          start_date: true,
          end_date: true,
          plan: {
            select: {
              annual_limit: true
            }
          },
          old_utilization: true,
        }
      })
    }
  }

  if (!principal) return { amount_utilized: 0, total_limit: 0, balance: 0, utilization_percentage: 0 }

  const principalId = principal.id

  const now = new Date()
  const currentYear = now.getFullYear()
  const defaultStartDate = new Date(currentYear, 0, 1)
  const defaultEndDate = new Date(currentYear, 11, 31, 23, 59, 59, 999)
  const startDate = principal.start_date ? new Date(principal.start_date) : defaultStartDate
  const endDate = principal.end_date
    ? new Date(new Date(principal.end_date).setHours(23, 59, 59, 999))
    : (principal.start_date ? now : defaultEndDate)
  if (startDate > endDate) {
    startDate.setTime(defaultStartDate.getTime())
    endDate.setTime(defaultEndDate.getTime())
  }

  const dependents = await prisma.dependent.findMany({
    where: { principal_id: principalId },
    select: {
      dependent_id: true,
      old_utilization: true,
    }
  })

  const utilizationIds = [
    principal.enrollee_id,
    ...dependents.map(d => d.dependent_id)
  ]

  // 1. Claims usage
  const claimsUsage = await prisma.claim.aggregate({
    where: {
      enrollee_id: { in: utilizationIds },
      status: { in: USABLE_CLAIM_STATUSES },
      submitted_at: { gte: startDate, lte: endDate }
    },
    _sum: { amount: true }
  })

  // 2. Unused approved codes (blocked balance)
  const codeUsage = await prisma.approvalCode.aggregate({
    where: {
      enrollee_id: principalId,
      status: 'APPROVED',
      is_deleted: false,
      claim_id: null,
      created_at: { gte: startDate, lte: endDate }
    },
    _sum: { amount: true }
  })

  const carryForwardUsed =
    Number(principal.old_utilization ?? 0) +
    dependents.reduce((sum, dependent) => sum + Number(dependent.old_utilization ?? 0), 0)
  const used =
    Number(claimsUsage._sum.amount ?? 0) +
    Number(codeUsage._sum.amount ?? 0) +
    carryForwardUsed
  const limit = Number(principal.plan?.annual_limit ?? 0)
  const percentage = limit > 0 ? (used / limit) * 100 : 0

  return {
    amount_utilized: used,
    total_limit: limit,
    balance: Math.max(0, limit - used),
    utilization_percentage: percentage
  }
}
