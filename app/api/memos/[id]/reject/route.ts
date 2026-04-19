import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import { sendMemoRejectedNotification } from '@/lib/memo-notifications'

/**
 * Memo Rejection Endpoint
 * Rejects a memo at any approval stage
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

        const { reason } = await request.json()
        const memoId = params.id

        if (!reason) {
            return NextResponse.json(
                { error: 'Rejection reason is required' },
                { status: 400 }
            )
        }

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

        // Check permissions based on current status
        let hasPermission = false
        let rejectionData: any = {
            status: 'REJECTED',
            rejection_reason: reason,
        }

        if (memo.status === 'PENDING_DEPT_OVERSIGHT') {
            hasPermission = await checkPermission(
                session.user.role as any,
                'department-oversight',
                'approve'
            )
            rejectionData.dept_oversight_status = 'REJECTED'
            rejectionData.dept_oversight_approved_by = session.user.id
            rejectionData.dept_oversight_approved_at = new Date()
            rejectionData.dept_oversight_comments = reason
        } else if (memo.status === 'PENDING_EXECUTIVE') {
            hasPermission = await checkPermission(
                session.user.role as any,
                'executive-desk',
                'approve'
            )
            rejectionData.executive_status = 'REJECTED'
            rejectionData.executive_approved_by = session.user.id
            rejectionData.executive_approved_at = new Date()
            rejectionData.executive_comments = reason
        } else {
            return NextResponse.json(
                { error: 'Memo is not in a state that can be rejected' },
                { status: 400 }
            )
        }

        if (!hasPermission) {
            return NextResponse.json(
                { error: 'You do not have permission to reject this memo' },
                { status: 403 }
            )
        }

        // Update memo status
        const updatedMemo = await prisma.memo.update({
            where: { id: memoId },
            data: rejectionData,
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

        // Send email notification to initiator
        await sendMemoRejectedNotification(updatedMemo.id)

        return NextResponse.json({
            success: true,
            memo: updatedMemo,
            message: 'Memo rejected and returned to initiator'
        })

    } catch (error) {
        console.error('Error rejecting memo:', error)
        return NextResponse.json(
            { error: 'Failed to reject memo' },
            { status: 500 }
        )
    }
}
