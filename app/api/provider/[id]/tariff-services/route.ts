import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCategoryLimitAvailability, withCategoryLimitMetrics } from '@/lib/call-centre/category-limit-metrics'

/**
 * Get tariff services for a specific provider
 * Used by Call Centre to show services when generating encounter codes
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const providerId = params.id

        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search')
        const enrolleeId = searchParams.get('enrollee_id')
        const trimmedSearch = search?.trim()

        const uploadedTariff = await prisma.providerTariffFile.findUnique({
            where: { provider_id: providerId },
            select: { id: true }
        })
        const uploadedTariffExists = Boolean(uploadedTariff)

        // Get tariff services for this provider
        const whereClause: any = {
            provider_id: providerId,
            status: 'ACTIVE'
        }

        if (trimmedSearch) {
            whereClause.service_name = {
                contains: trimmedSearch,
                mode: 'insensitive'
            }
        }

        const tariffServices = await prisma.tariffPlanService.findMany({
            where: whereClause,
            orderBy: {
                service_name: 'asc'
            }
        })

        if (!uploadedTariffExists && tariffServices.length === 0) {
            return NextResponse.json({
                success: true,
                services: [],
                count: 0,
                message: "No tariff uploaded for this provider yet."
            })
        }

        // Format services for dropdown
        const services = tariffServices.map(ts => ({
            id: ts.id,
            service_id: ts.service_id,
            service_name: ts.service_name,
            service_category: ts.category_name,
            category_name: ts.category_name,
            price: ts.price,
            service_type: ts.service_type,
            facility_price: ts.price
        }))
        const servicesWithMetrics = await withCategoryLimitMetrics(services, enrolleeId)
        const servicesWithAvailability = servicesWithMetrics.map((service) => {
            const availability = getCategoryLimitAvailability(service)
            return {
                ...service,
                coverage_status: availability.coverageStatus,
                selectable: !availability.isBlocked,
                status_message: availability.reason
            }
        })

        return NextResponse.json({
            success: true,
            services: servicesWithAvailability,
            count: servicesWithAvailability.length
        })

    } catch (error) {
        console.error('Error fetching provider tariff services:', error)
        return NextResponse.json(
            { error: 'Failed to fetch services' },
            { status: 500 }
        )
    }
}
