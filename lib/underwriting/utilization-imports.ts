import { Prisma } from "@prisma/client"

type UtilizationImportTx = {
  principalAccount: {
    update(args: Prisma.PrincipalAccountUpdateArgs): Promise<unknown>
  }
  dependent: {
    update(args: Prisma.DependentUpdateArgs): Promise<unknown>
  }
  utilizationImport: {
    findFirst(args: Prisma.UtilizationImportFindFirstArgs): Promise<{
      id: string
      amount: Prisma.Decimal
    } | null>
    create(args: Prisma.UtilizationImportCreateArgs): Promise<unknown>
    update(args: Prisma.UtilizationImportUpdateArgs): Promise<unknown>
  }
}

export function normalizeUtilizationPeriodLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

export function buildUtilizationPeriodKey(value: string): string {
  return normalizeUtilizationPeriodLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function appendPrincipalUtilizationImport(
  tx: UtilizationImportTx,
  input: {
    principalId: string
    periodLabel: string
    amount: number
    userId?: string | null
  }
) {
  const normalizedAmount = Number(input.amount)
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) return

  const periodLabel = normalizeUtilizationPeriodLabel(input.periodLabel)
  const periodKey = buildUtilizationPeriodKey(periodLabel)

  const existing = await tx.utilizationImport.findFirst({
    where: {
      principal_account_id: input.principalId,
      period_key: periodKey,
    },
    select: {
      id: true,
      amount: true,
    },
  })

  if (existing) {
    await tx.utilizationImport.update({
      where: { id: existing.id },
      data: {
        amount: Number(existing.amount) + normalizedAmount,
        period_label: periodLabel,
      },
    })
  } else {
    await tx.utilizationImport.create({
      data: {
        principal_account_id: input.principalId,
        period_label: periodLabel,
        period_key: periodKey,
        amount: normalizedAmount,
        created_by_id: input.userId ?? null,
      },
    })
  }

  await tx.principalAccount.update({
    where: { id: input.principalId },
    data: {
      old_utilization: {
        increment: normalizedAmount,
      },
    },
  })
}

export async function appendDependentUtilizationImport(
  tx: UtilizationImportTx,
  input: {
    dependentId: string
    periodLabel: string
    amount: number
    userId?: string | null
  }
) {
  const normalizedAmount = Number(input.amount)
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) return

  const periodLabel = normalizeUtilizationPeriodLabel(input.periodLabel)
  const periodKey = buildUtilizationPeriodKey(periodLabel)

  const existing = await tx.utilizationImport.findFirst({
    where: {
      dependent_id: input.dependentId,
      period_key: periodKey,
    },
    select: {
      id: true,
      amount: true,
    },
  })

  if (existing) {
    await tx.utilizationImport.update({
      where: { id: existing.id },
      data: {
        amount: Number(existing.amount) + normalizedAmount,
        period_label: periodLabel,
      },
    })
  } else {
    await tx.utilizationImport.create({
      data: {
        dependent_id: input.dependentId,
        period_label: periodLabel,
        period_key: periodKey,
        amount: normalizedAmount,
        created_by_id: input.userId ?? null,
      },
    })
  }

  await tx.dependent.update({
    where: { id: input.dependentId },
    data: {
      old_utilization: {
        increment: normalizedAmount,
      },
    },
  })
}
