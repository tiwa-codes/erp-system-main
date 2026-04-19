import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const query = searchParams.get('q')

        if (!query) {
            return NextResponse.json({ enrollees: [] })
        }

        const enrollees = await prisma.principalAccount.findMany({
            where: {
                OR: [
                    { first_name: { contains: query, mode: 'insensitive' } },
                    { last_name: { contains: query, mode: 'insensitive' } },
                    { middle_name: { contains: query, mode: 'insensitive' } },
                    { enrollee_id: { contains: query, mode: 'insensitive' } },
                    {
                        dependents: {
                            some: {
                                OR: [
                                    { dependent_id: { contains: query, mode: 'insensitive' } },
                                    { first_name: { contains: query, mode: 'insensitive' } },
                                    { last_name: { contains: query, mode: 'insensitive' } }
                                ]
                            }
                        }
                    }
                ]
            },
            take: 10,
            include: {
                organization: {
                    select: { name: true }
                },
                plan: {
                    select: { name: true }
                },
                dependents: true
            }
        })

        return NextResponse.json(enrollees)

    } catch (error) {
        console.error('Error searching enrollees:', error)
        return NextResponse.json(
            { error: 'Failed to search enrollees' },
            { status: 500 }
        )
    }
}
