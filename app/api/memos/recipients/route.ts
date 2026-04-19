import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/memos/recipients?search=...
 * Returns a list of system users for memo recipient selection.
 * Any authenticated user can access this.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search') || ''

        const where: any = {
            status: 'ACTIVE',
            // Exclude the current user (can't send to yourself)
            // Exclude provider-linked users (providers have a user account but are not staff)
            NOT: [
                { id: session.user.id },
                { provider_id: { not: null } },
            ],
        }

        if (search.trim()) {
            where.OR = [
                { first_name: { contains: search, mode: 'insensitive' } },
                { last_name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ]
        }

        const users = await prisma.user.findMany({
            where,
            take: 20,
            orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
            select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                role: { select: { name: true } },
                department: { select: { name: true } },
            }
        })

        return NextResponse.json({ users })
    } catch (error) {
        console.error('Error fetching memo recipients:', error)
        return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 })
    }
}
