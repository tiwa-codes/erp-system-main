import { prisma } from "@/lib/prisma"
import { notificationService } from "@/lib/notifications"
import { getUsersForStage, VettingStage } from "./vetting-workflow"

const stageNames: Record<VettingStage, string> = {
  vetter1: "Vetter 1",
  vetter2: "Vetter 2",
  audit: "Audit",
  approval: "MD Approval",
}

/**
 * Send notifications when a claim moves to a new stage
 */
export async function notifyStageUsers(
  claimId: string,
  stage: VettingStage,
  claimNumber: string
) {
  try {
    const users = await getUsersForStage(stage)
    if (users.length === 0) {
      return
    }

    const stageName = stageNames[stage]

    const notificationJobs = users.map(async (user) => {
      try {
        await prisma.auditLog.create({
          data: {
            user_id: user.id,
            action: "CLAIM_AWAITING_REVIEW",
            resource: "claim",
            resource_id: claimId,
            new_values: {
              claim_number: claimNumber,
              stage,
              message: `Claim ${claimNumber} is waiting for you at ${stageName}.`,
            },
          },
        })

        await notificationService.sendEmail({
          to: user.email,
          subject: `New Claim Awaiting Review - ${claimNumber}`,
          html: `
            <h2>New Claim Awaiting Your Review</h2>
            <p>Hello ${user.first_name} ${user.last_name},</p>
            <p>Claim <strong>${claimNumber}</strong> is waiting for you at <strong>${stageName}</strong>.</p>
            <p>Please review and process the claim at your earliest convenience.</p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/claims/${stage}/vetter">View Claim</a></p>
            <p>Best regards,<br/>CrownJewel ERP System</p>
          `,
          text: `Claim ${claimNumber} is waiting for you at ${stageName}. Please review and process the claim.`,
        })
      } catch (error) {
        console.error(`Failed to notify ${user.email}:`, error)
      }
    })

    await Promise.allSettled(notificationJobs)
  } catch (error) {
    console.error("Failed to notify stage users:", error)
  }
}
