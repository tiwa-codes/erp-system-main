import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendMemoApprovedNotification } from '@/lib/memo-notifications'

/**
 * Executive Desk Approval Endpoint
 * Final approval of a memo
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

        // Only the Managing Director (MD) role — or SUPER_ADMIN — may give final approval
        const userWithRole = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: { select: { name: true } } }
        })
        const roleName = (userWithRole?.role?.name || '').toUpperCase().replace(/\s+/g, '_')
        const isMD = roleName.includes('MD') || roleName.includes('MANAGING_DIRECTOR') || roleName === 'SUPER_ADMIN'

        if (!isMD) {
            return NextResponse.json(
                { error: 'Only the Managing Director (MD) may give final approval on memos' },
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
        if (memo.status !== 'PENDING_EXECUTIVE') {
            return NextResponse.json(
                { error: 'Memo is not pending executive approval' },
                { status: 400 }
            )
        }

        // Update memo status
        const updatedMemo = await prisma.memo.update({
            where: { id: memoId },
            data: {
                status: 'APPROVED',
                executive_status: 'APPROVED',
                executive_approved_by: session.user.id,
                executive_approved_at: new Date(),
                executive_comments: comments || null,
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

        // Send email notification to initiator
        await sendMemoApprovedNotification(updatedMemo.id)

        return NextResponse.json({
            success: true,
            memo: updatedMemo,
            message: 'Memo approved successfully'
        })

    } catch (error) {
        console.error('Error approving memo:', error)
        return NextResponse.json(
            { error: 'Failed to approve memo' },
            { status: 500 }
        )
    }
}
