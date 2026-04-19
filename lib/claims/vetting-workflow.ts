import { prisma } from "@/lib/prisma"

export type VettingStage = 'vetter1' | 'vetter2' | 'audit' | 'approval'
export type VettingActionType = 'APPROVED' | 'REJECTED' | 'REJECTED_BACK'

/**
 * Get the next stage in the workflow
 */
export function getNextStage(currentStage: VettingStage): VettingStage | null {
  const stageFlow: Record<VettingStage, VettingStage | null> = {
    vetter1: 'vetter2',
    vetter2: 'audit',
    audit: 'approval',
    approval: null // Final stage
  }
  return stageFlow[currentStage] || null
}

/**
 * Get the previous stage in the workflow (for rejections)
 */
export function getPreviousStage(currentStage: VettingStage): VettingStage | null {
  const stageFlow: Record<VettingStage, VettingStage | null> = {
    vetter1: null, // Can reject back to provider
    vetter2: 'vetter1',
    audit: 'vetter2',
    approval: 'audit'
  }
  return stageFlow[currentStage] || null
}

/**
 * Check if a user can take action on a claim at a specific stage
 */
export async function canTakeAction(
  claimId: string,
  stage: VettingStage,
  userId: string
): Promise<{ canTakeAction: boolean; reason?: string }> {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: {
      id: true,
      current_stage: true,
      status: true
    }
  })

  if (!claim) {
    return { canTakeAction: false, reason: 'Claim not found' }
  }

  // Check if claim is at the correct stage
  if (claim.current_stage !== stage) {
    return { canTakeAction: false, reason: `Claim is not at ${stage} stage` }
  }

  // Check if there's already an action at this stage that wasn't rejected back
  const lastAction = await prisma.vettingAction.findFirst({
    where: {
      claim_id: claimId,
      stage: stage
    },
    orderBy: { created_at: 'desc' }
  })

  // If there's an action and it's not a rejection back, user can't take action
  if (lastAction && lastAction.action !== 'REJECTED_BACK') {
    // Check if a later stage has since rejected the claim back here (e.g. vetter2 → vetter1)
    // This means the previous action is superseded and re-vetting is required
    const mostRecentOverall = await prisma.vettingAction.findFirst({
      where: { claim_id: claimId },
      orderBy: { created_at: 'desc' }
    })

    const hasBeenRejectedBackSince =
      mostRecentOverall &&
      mostRecentOverall.action === 'REJECTED_BACK' &&
      mostRecentOverall.stage !== stage &&
      mostRecentOverall.created_at > lastAction.created_at

    if (hasBeenRejectedBackSince) {
      return { canTakeAction: true }
    }

    // No later rejection — the earlier action still stands
    if (lastAction.action_by_id === userId) {
      return { canTakeAction: false, reason: 'You have already taken action on this claim' }
    }
    return { canTakeAction: false, reason: 'This claim has already been processed at this stage' }
  }

  return { canTakeAction: true }
}

/**
 * Get users who should be notified for a specific stage
 */
export async function getUsersForStage(stage: VettingStage): Promise<Array<{ id: string; email: string; first_name: string; last_name: string }>> {
  // Map stages to roles
  const roleMap: Record<VettingStage, string[]> = {
    vetter1: ['CLAIMS_PROCESSOR', 'CLAIMS_MANAGER'],
    vetter2: ['CLAIMS_PROCESSOR', 'CLAIMS_MANAGER'],
    audit: ['ADMIN', 'SUPER_ADMIN'], // Operations Desk
    approval: ['ADMIN', 'SUPER_ADMIN'] // Executive Desk / MD
  }

  const roles = roleMap[stage]

  // Find role records
  const roleRecords = await prisma.role.findMany({
    where: {
      name: { in: roles }
    },
    select: { id: true }
  })

  const roleIds = roleRecords.map(r => r.id)

  // Get users with these roles
  const users = await prisma.user.findMany({
    where: {
      role_id: { in: roleIds },
      status: 'ACTIVE'
    },
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true
    }
  })

  return users
}

/**
 * Update claim stage and status
 */
export async function updateClaimStage(
  claimId: string,
  newStage: VettingStage | null,
  status: string
): Promise<void> {
  await prisma.claim.update({
    where: { id: claimId },
    data: {
      current_stage: newStage,
      status: status as any,
      updated_at: new Date()
    }
  })
}

/**
 * Create vetting action record
 */
export async function createVettingAction(
  claimId: string,
  stage: VettingStage,
  action: VettingActionType,
  actionBy: string,
  comments?: string,
  serviceVerdicts?: any,
  tx?: any
): Promise<void> {
  const client = tx || prisma

  await client.vettingAction.create({
    data: {
      claim_id: claimId,
      stage: stage,
      action: action,
      action_by_id: actionBy,
      comments: comments || null,
      service_verdicts: serviceVerdicts || null
    }
  })

  // Update individual services if verdicts provided
  if (Array.isArray(serviceVerdicts)) {
    for (const verdict of serviceVerdicts) {
      if (verdict.id && !verdict.id.startsWith('created-')) {
        await client.approvalCodeService.update({
          where: { id: verdict.id },
          data: {
            vetted_amount: verdict.vetted_amount !== undefined ? verdict.vetted_amount : verdict.claimed_amount,
            // Persist quantity changes made during vetting
            ...(verdict.quantity != null ? { quantity: verdict.quantity } : {}),
            is_vetted_approved: verdict.verdict === 'COVERED' || verdict.verdict === 'APPROVED' || verdict.is_approved === true,
            rejection_reason: verdict.rejection_reason || (verdict.verdict === 'NOT_COVERED' || verdict.verdict === 'REJECTED' ? `Rejected at ${stage}` : null),
            is_deleted: verdict.is_deleted || false,
            category: verdict.category || null
          }
        })
      }
    }

    // Auto-sync Claim.amount to vetted total (sum of non-deleted services)
    const vettedTotal = serviceVerdicts
      .filter((v: any) => !v.is_deleted)
      .reduce((sum: number, v: any) => {
        const amt = v.vetted_amount !== undefined ? Number(v.vetted_amount) : Number(v.claimed_amount)
        return sum + (isNaN(amt) ? 0 : amt)
      }, 0)

    if (vettedTotal > 0) {
      await client.claim.update({
        where: { id: claimId },
        data: { amount: vettedTotal }
      })
    }
  }
}









