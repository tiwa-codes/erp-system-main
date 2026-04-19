import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        // Fetch all active organizations with basic info for public registration
        const organizations = await prisma.organization.findMany({
            where: {
                status: 'ACTIVE'
            },
            select: {
                id: true,
                name: true,
                code: true,
                contact_info: true,
            },
            orderBy: { name: 'asc' }
        })

        // Format the response to include contact details
        const formattedOrganizations = organizations.map(org => ({
            id: org.id,
            name: org.name,
            code: org.code,
            email: (org.contact_info as any)?.email || "",
            phone: (org.contact_info as any)?.contactNumber || "",
            address: (org.contact_info as any)?.headOfficeAddress || "",
        }))

        return NextResponse.json({
            success: true,
            organizations: formattedOrganizations
        })
    } catch (error) {
        console.error('Error fetching public organizations:', error)
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch organizations'
            },
            { status: 500 }
        )
    }
}
