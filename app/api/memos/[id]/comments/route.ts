import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Memo Comments Endpoint
 * GET: Fetch all comments for a memo
 * POST: Add a new comment to a memo
 */

// GET - Fetch comments
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const memoId = params.id

        // Fetch comments with user details
        const comments = await prisma.memoComment.findMany({
            where: { memo_id: memoId },
            include: {
                user: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                    }
                }
            },
            orderBy: {
                created_at: 'asc'
            }
        })

        return NextResponse.json({ comments })

    } catch (error) {
        console.error('Error fetching comments:', error)
        return NextResponse.json(
            { error: 'Failed to fetch comments' },
            { status: 500 }
        )
    }
}

// POST - Add comment
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { comment } = await request.json()
        const memoId = params.id

        if (!comment || comment.trim() === '') {
            return NextResponse.json(
                { error: 'Comment cannot be empty' },
                { status: 400 }
            )
        }

        // Verify memo exists
        const memo = await prisma.memo.findUnique({
            where: { id: memoId }
        })

        if (!memo) {
            return NextResponse.json({ error: 'Memo not found' }, { status: 404 })
        }

        // Create comment
        const newComment = await prisma.memoComment.create({
            data: {
                memo_id: memoId,
                user_id: session.user.id,
                comment: comment.trim(),
            },
            include: {
                user: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                    }
                }
            }
        })

        return NextResponse.json({
            success: true,
            comment: newComment,
            message: 'Comment added successfully'
        })

    } catch (error) {
        console.error('Error adding comment:', error)
        return NextResponse.json(
            { error: 'Failed to add comment' },
            { status: 500 }
        )
    }
}
