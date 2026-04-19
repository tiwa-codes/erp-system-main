import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import { attachExecutiveMemoRecipients, sendMemoConfirmedNotification } from '@/lib/memo-notifications'

/**
 * Department Oversight Approval Endpoint
 * Approves a memo and forwards it to Executive Desk
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user has department-oversight approve permission
        const hasPermission = await checkPermission(
            session.user.role as any,
            'department-oversight',
            'approve'
        )

        if (!hasPermission) {
            return NextResponse.json(
                { error: 'You do not have permission to approve memos' },
                { status: 403 }
            )
        }

        const { comments } = await request.json()
        const memoId = params.id

        // Get the memo
        const memo = await prisma.memo.findUnique({
            where: { id: memoId },
            include: {
                employee: {
                    include: {
                        department: true
                    }
                }
            }
        })

        if (!memo) {
            return NextResponse.json({ error: 'Memo not found' }, { status: 404 })
        }

        // Check if memo is in correct status
        if (memo.status !== 'PENDING_DEPT_OVERSIGHT') {
            return NextResponse.json(
                { error: 'Memo is not pending department oversight approval' },
                { status: 400 }
            )
        }

        // Update memo status
        const updatedMemo = await prisma.memo.update({
            where: { id: memoId },
            data: {
                status: 'PENDING_EXECUTIVE',
                dept_oversight_status: 'APPROVED',
                dept_oversight_approved_by: session.user.id,
                dept_oversight_approved_at: new Date(),
                dept_oversight_comments: comments || null,
            },
            include: {
                employee: {
                    include: {
                        department: true
                    }
                },
                dept_oversight_approver: true,
                executive_approver: true,
            }
        })

        await attachExecutiveMemoRecipients(updatedMemo.id)

        // Send email notification to Executive Desk and initiator
        await sendMemoConfirmedNotification(updatedMemo.id)

        return NextResponse.json({
            success: true,
            memo: updatedMemo,
            message: 'Memo confirmed and forwarded to Executive Desk'
        })

    } catch (error) {
        console.error('Error approving memo:', error)
        return NextResponse.json(
            { error: 'Failed to approve memo' },
            { status: 500 }
        )
    }
}
