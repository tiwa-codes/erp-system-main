import { prisma } from "@/lib/prisma"

export type StageTransition = {
  id: string
  currentStage: string
  nextStage: string
  nextStatus?: string
  extraData?: Record<string, unknown>
}

export async function transitionTariffPlanStage({
  id,
  currentStage,
  nextStage,
  nextStatus,
  extraData
}: StageTransition) {
  const tariffPlan = await prisma.tariffPlan.findUnique({
    where: { id }
  })

  if (!tariffPlan) {
    return { error: "Tariff plan not found", status: 404 }
  }

  if (!tariffPlan.is_customized) {
    return { error: "Only customized plans follow this workflow", status: 400 }
  }

  if (tariffPlan.status !== "PENDING_APPROVAL") {
    return { error: "Tariff plan must be pending approval to progress", status: 400 }
  }

  if (tariffPlan.approval_stage !== currentStage) {
    return {
      error: `Tariff plan is currently at ${tariffPlan.approval_stage} stage (status: ${tariffPlan.status}). Please refresh and try again.`,
      status: 409,
    }
  }

  const data: Record<string, unknown> = {
    approval_stage: nextStage
  }

  if (nextStatus) {
    data.status = nextStatus
    if (nextStatus === "COMPLETE") {
      data.approved_at = new Date()
    }
  }

  if (extraData) {
    Object.assign(data, extraData)
  }

  const updatedPlan = await prisma.tariffPlan.update({
    where: { id },
    data,
    include: {
      provider: true,
      approved_by: true
    }
  })

  return { tariffPlan: updatedPlan }
}
