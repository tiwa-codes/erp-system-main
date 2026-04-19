import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/memos/[id]/read
 * Mark the memo as read for the current user (sets read_at on MemoRecipient).
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        await prisma.memoRecipient.updateMany({
            where: {
                memo_id: params.id,
                user_id: session.user.id,
                read_at: null,
            },
            data: { read_at: new Date() }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error marking memo as read:', error)
        return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 })
    }
}
