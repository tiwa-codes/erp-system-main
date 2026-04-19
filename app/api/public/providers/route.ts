import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search') || ''
        const bandsParam = searchParams.get('bands')

        const bands = bandsParam ? bandsParam.split(',').filter(b => b.trim() !== '') : []

        const where: any = {
            status: 'ACTIVE' // Only show active providers
        }

        if (search) {
            where.OR = [
                { facility_name: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } }
            ]
        }

        // Apply band filtering if bands are provided
        if (bands.length > 0) {
            where.band = { in: bands }
        }

        const providers = await prisma.provider.findMany({
            where,
            select: {
                id: true,
                facility_name: true,
                address: true,
                band: true,
            },
            orderBy: {
                facility_name: 'asc'
            },
            take: 50
        })

        return NextResponse.json({
            success: true,
            providers
        })
    } catch (error) {
        console.error('Error fetching public providers:', error)
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch providers'
            },
            { status: 500 }
        )
    }
}
