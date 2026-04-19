/**
 * Memo Email Notification Helper
 * Sends email notifications for memo approval workflow
 */

import { notificationService } from './notifications'
import { prisma } from './prisma'

interface MemoNotificationData {
    memoId: string
    memoTitle: string
    initiatorName: string
    initiatorEmail: string
    approverName?: string
    rejectionReason?: string
    comments?: string
}

async function getExecutiveMemoRecipients() {
    const executiveEmailFallbacks = [
        'admin@erp.com',
        'aliyu.sumaila@crownjewelhmo.com',
    ]

    return prisma.user.findMany({
        where: {
            status: 'ACTIVE',
            provider_id: null,
            OR: [
                ...executiveEmailFallbacks.map(email => ({
                    email: { equals: email, mode: 'insensitive' as const }
                })),
                {
                    role: {
                        OR: [
                            { name: 'SUPER_ADMIN' },
                            { name: 'SUPERADMIN' },
                            { name: 'ADMIN' },
                            { name: { contains: 'MD', mode: 'insensitive' } },
                            { name: { contains: 'MANAGING_DIRECTOR', mode: 'insensitive' } },
                        ]
                    }
                }
            ]
        }
    })
}

function buildPersonName(person?: { first_name?: string | null; last_name?: string | null } | null, fallback = 'Unknown User') {
    const fullName = `${person?.first_name || ''} ${person?.last_name || ''}`.trim()
    return fullName || fallback
}

function getMemoInitiator(memo: {
    employee?: { first_name: string; last_name: string; email: string } | null
    sender_user?: { first_name: string; last_name: string; email: string } | null
}) {
    if (memo.sender_user) {
        return {
            name: buildPersonName(memo.sender_user, 'System User'),
            email: memo.sender_user.email,
        }
    }

    if (memo.employee) {
        return {
            name: buildPersonName(memo.employee, 'Employee'),
            email: memo.employee.email,
        }
    }

    return null
}

/**
 * Send notification when memo is submitted
 */
export async function sendMemoSubmittedNotification(memoId: string) {
    try {
        const memo = await prisma.memo.findUnique({
            where: { id: memoId },
            include: {
                employee: true,
                sender_user: true,
            }
        })

        if (!memo) return
        const initiator = getMemoInitiator(memo)
        if (!initiator) return

        // Get Department Oversight users
        const deptOversightUsers = await prisma.user.findMany({
            where: {
                role: {
                    name: {
                      in: ['SUPER_ADMIN', 'SUPERADMIN'],
                      mode: 'insensitive'
                    }
                },
                status: 'ACTIVE'
            }
        })

        for (const user of deptOversightUsers) {
            await notificationService.sendEmail({
                to: user.email,
                subject: `New Memo Pending Review: ${memo.title}`,
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">New Memo Pending Department Oversight Review</h2>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">${memo.title}</h3>
              <p><strong>From:</strong> ${initiator.name}</p>
              <p><strong>Priority:</strong> ${memo.priority}</p>
              <p><strong>Submitted:</strong> ${memo.created_at.toLocaleDateString()}</p>
            </div>

            <div style="margin: 20px 0;">
              <p><strong>Content:</strong></p>
              <p style="white-space: pre-wrap;">${memo.content.substring(0, 200)}${memo.content.length > 200 ? '...' : ''}</p>
            </div>

            <div style="margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/department-oversight/memos" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Review Memo
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This memo requires your review and confirmation before it can proceed to Executive Desk.
            </p>
          </div>
        `
            })
        }
    } catch (error) {
        console.error('Error sending memo submitted notification:', error)
    }
}

/**
 * Send notification when memo is confirmed to Executive Desk
 */
export async function sendMemoConfirmedNotification(memoId: string) {
    try {
        const memo = await prisma.memo.findUnique({
            where: { id: memoId },
            include: {
                employee: true,
                sender_user: true,
                dept_oversight_approver: true
            }
        })

        if (!memo) return
        const initiator = getMemoInitiator(memo)
        if (!initiator) return

        // Get Executive Desk users
        const executiveUsers = await getExecutiveMemoRecipients()

        const approverName = memo.dept_oversight_approver
            ? `${memo.dept_oversight_approver.first_name} ${memo.dept_oversight_approver.last_name}`
            : 'Department Oversight'

        for (const user of executiveUsers) {
            await notificationService.sendEmail({
                to: user.email,
                subject: `Memo Confirmed for Executive Approval: ${memo.title}`,
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">Memo Confirmed - Pending Executive Approval</h2>
            
            <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
              <h3 style="margin-top: 0;">${memo.title}</h3>
              <p><strong>From:</strong> ${initiator.name}</p>
              <p><strong>Confirmed by:</strong> ${approverName}</p>
              <p><strong>Priority:</strong> ${memo.priority}</p>
            </div>

            ${memo.dept_oversight_comments ? `
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Department Oversight Comments:</strong></p>
                <p style="margin: 10px 0 0 0; font-style: italic;">${memo.dept_oversight_comments}</p>
              </div>
            ` : ''}

            <div style="margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/executive-desk/memos" 
                 style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Review for Approval
              </a>
            </div>
          </div>
        `
            })
        }

        // Notify initiator
        await notificationService.sendEmail({
            to: initiator.email,
            subject: `Your Memo Has Been Confirmed: ${memo.title}`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #16a34a;">Your Memo Has Been Confirmed</h2>
          
          <p>Good news! Your memo "<strong>${memo.title}</strong>" has been confirmed by ${approverName} and forwarded to Executive Desk for final approval.</p>

          ${memo.dept_oversight_comments ? `
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Comments:</strong></p>
              <p style="margin: 10px 0 0 0;">${memo.dept_oversight_comments}</p>
            </div>
          ` : ''}

          <p style="color: #6b7280; margin-top: 30px;">You will be notified once the Executive Desk reviews your memo.</p>
        </div>
      `
        })
    } catch (error) {
        console.error('Error sending memo confirmed notification:', error)
    }
}

export async function attachExecutiveMemoRecipients(memoId: string) {
    const executiveUsers = await getExecutiveMemoRecipients()
    if (!executiveUsers.length) return

    await prisma.memoRecipient.createMany({
        data: executiveUsers.map(user => ({
            memo_id: memoId,
            user_id: user.id,
        })),
        skipDuplicates: true,
    })
}

/**
 * Send notification when memo is approved
 */
export async function sendMemoApprovedNotification(memoId: string) {
    try {
        const memo = await prisma.memo.findUnique({
            where: { id: memoId },
            include: {
                employee: true,
                sender_user: true,
                executive_approver: true
            }
        })

        if (!memo) return
        const initiator = getMemoInitiator(memo)
        if (!initiator) return

        const approverName = memo.executive_approver
            ? `${memo.executive_approver.first_name} ${memo.executive_approver.last_name}`
            : 'Executive Desk'

        await notificationService.sendEmail({
            to: initiator.email,
            subject: `✅ Memo Approved: ${memo.title}`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #16a34a;">✅ Your Memo Has Been Approved!</h2>
          
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
            <h3 style="margin-top: 0;">${memo.title}</h3>
            <p><strong>Approved by:</strong> ${approverName}</p>
            <p><strong>Approved on:</strong> ${memo.executive_approved_at?.toLocaleDateString()}</p>
          </div>

          ${memo.executive_comments ? `
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Executive Comments:</strong></p>
              <p style="margin: 10px 0 0 0;">${memo.executive_comments}</p>
            </div>
          ` : ''}

          <p style="color: #16a34a; font-weight: 600;">Your memo has been fully approved and is now active.</p>
        </div>
      `
        })
    } catch (error) {
        console.error('Error sending memo approved notification:', error)
    }
}

/**
 * Send notification when memo is rejected
 */
export async function sendMemoRejectedNotification(memoId: string) {
    try {
        const memo = await prisma.memo.findUnique({
            where: { id: memoId },
            include: {
                employee: true,
                sender_user: true,
                dept_oversight_approver: true,
                executive_approver: true
            }
        })

        if (!memo) return
        const initiator = getMemoInitiator(memo)
        if (!initiator) return

        const rejectorName = memo.executive_approver
            ? `${memo.executive_approver.first_name} ${memo.executive_approver.last_name}`
            : memo.dept_oversight_approver
                ? `${memo.dept_oversight_approver.first_name} ${memo.dept_oversight_approver.last_name}`
                : 'Approver'

        await notificationService.sendEmail({
            to: initiator.email,
            subject: `Memo Rejected: ${memo.title}`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Memo Rejected</h2>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <h3 style="margin-top: 0;">${memo.title}</h3>
            <p><strong>Rejected by:</strong> ${rejectorName}</p>
          </div>

          ${memo.rejection_reason ? `
            <div style="background-color: #fff7ed; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Reason for Rejection:</strong></p>
              <p style="margin: 10px 0 0 0; color: #dc2626;">${memo.rejection_reason}</p>
            </div>
          ` : ''}

          <p>Please review the feedback and make necessary changes before resubmitting.</p>

          <div style="margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/hr/memos" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Memo
            </a>
          </div>
        </div>
      `
        })
    } catch (error) {
        console.error('Error sending memo rejected notification:', error)
    }
}
