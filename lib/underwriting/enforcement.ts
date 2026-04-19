import type { Plan, PlanLimit, PrincipalAccount } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export const USABLE_CLAIM_STATUSES = [
  "NEW",
  "PENDING",
  "SUBMITTED",
  "UNDER_REVIEW",
  "VETTING",
  "VETTER1_COMPLETED",
  "VETTER2_COMPLETED",
  "AUDIT_COMPLETED",
  "APPROVED",
  "PAID",
]

export type PlanEnforcementOptions = {
  principalId: string
  attemptedAmount?: number
}

export type PlanUsageSnapshot = {
  planId: string
  planName: string
  annualLimit: number
  totalUsed: number
  utilization: number
  planLimits: PlanLimit[]
  warnings: string[]
}

export type PlanEnforcementResult =
  | {
      principal: PrincipalAccount & {
        plan: Plan & {
          plan_limits: PlanLimit[]
        }
      }
      plan: Plan & {
        plan_limits: PlanLimit[]
      }
      totalUsed: number
      annualLimit: number
      utilization: number
      warnings: string[]
      isBlocked: boolean
      usageSnapshot: PlanUsageSnapshot
    }
  | {
      error: string
      status: number
    }

export async function enforcePlanUsage({
  principalId,
  attemptedAmount = 0,
}: PlanEnforcementOptions): Promise<PlanEnforcementResult> {
  const principal = await prisma.principalAccount.findUnique({
    where: { id: principalId },
    include: {
      plan: {
        include: {
          plan_limits: true,
        },
      },
    },
  })

  if (!principal) {
    return { error: "Principal not found", status: 404 }
  }

  const plan = principal.plan

  if (!plan) {
    return { error: "Principal does not have an assigned plan", status: 400 }
  }

  const usageAggregate = await prisma.claim.aggregate({
    _sum: {
      amount: true,
    },
    where: {
      principal_id: principalId,
      status: {
        in: USABLE_CLAIM_STATUSES,
      },
      // Ensure we only count claims from the current year (annual limit)
      submitted_at: {
        gte: new Date(new Date().getFullYear(), 0, 1),
        lte: new Date(new Date().getFullYear(), 11, 31),
      },
    },
  })

  // Also include unused but approved codes to prevent double-spending
  const unusedApprovalCodes = await prisma.approvalCode.aggregate({
    _sum: {
      amount: true,
    },
    where: {
      enrollee_id: principalId,
      status: 'APPROVED',
      is_deleted: false,
      claim_id: null, // Only count codes that haven't been converted to claims yet
      created_at: {
        gte: new Date(new Date().getFullYear(), 0, 1),
        lte: new Date(new Date().getFullYear(), 11, 31),
      },
    }
  })

  const totalUsed = Number(usageAggregate._sum.amount ?? 0) + Number(unusedApprovalCodes._sum.amount ?? 0)
  const annualLimit = Number(plan.annual_limit ?? 0)
  const nextTotal = totalUsed + attemptedAmount

  const warnings: string[] = []
  let isBlocked = false

  // Allow ACTIVE and COMPLETE plans, block all other statuses
  const allowedStatuses = ["ACTIVE", "COMPLETE"]
  if (!allowedStatuses.includes(plan.status)) {
    warnings.push(`Plan is in ${plan.status} status and cannot be used for new claims yet.`)
    isBlocked = true
  }

  if (annualLimit > 0 && nextTotal > annualLimit) {
    warnings.push(
      `Plan annual limit of ₦${annualLimit.toLocaleString()} would be exceeded (current usage ₦${totalUsed.toLocaleString()}, requested ₦${attemptedAmount.toLocaleString()}).`
    )
    isBlocked = true
  }

  const utilization =
    annualLimit > 0 ? Number(((nextTotal / annualLimit) * 100).toFixed(2)) : 0

  const usageSnapshot: PlanUsageSnapshot = {
    planId: plan.id,
    planName: plan.name,
    annualLimit,
    totalUsed,
    utilization,
    planLimits: plan.plan_limits,
    warnings,
  }

  return {
    principal: principal as PrincipalAccount &
      {
        plan: Plan & {
          plan_limits: PlanLimit[]
        }
      },
    plan,
    totalUsed,
    annualLimit,
    utilization,
    warnings,
    isBlocked,
    usageSnapshot,
  }
}

