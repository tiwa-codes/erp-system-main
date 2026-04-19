import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCategoryLimitAvailability, withCategoryLimitMetrics } from "@/lib/call-centre/category-limit-metrics"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search')
        const enrolleeId = searchParams.get('enrollee_id')
        const trimmedSearch = search?.trim()

        const where: any = {
            is_nhia_service: true
        }

        if (trimmedSearch) {
            where.service_name = {
                contains: trimmedSearch,
                mode: 'insensitive'
            }
        }

        // Fetch NHIA services (removed price > 0 check to allow zero-price/negotiable services)
        const nhiaServices = await prisma.serviceType.findMany({
            where,
            orderBy: {
                service_name: 'asc'
            },
            take: 100 // Limit results for performance
        })

        // Format services for the request form
        const formattedServices = nhiaServices.map(service => ({
            id: service.id,
            name: service.service_name,
            amount: Number(service.nhia_price),
            price: Number(service.nhia_price),
            service_type: service.service_type === 'PRIMARY_SERVICE' ? 1 : null,
            category: service.service_category,
            category_id: service.service_category,
            service_category: service.service_category,
            is_nhia: true,
            coverage: 'COVERED' // NHIA services are typically covered
        }))
        const servicesWithMetrics = await withCategoryLimitMetrics(formattedServices, enrolleeId)
        const servicesWithAvailability = servicesWithMetrics.map((service) => {
            const availability = getCategoryLimitAvailability(service)
            return {
                ...service,
                coverage: availability.coverageStatus,
                coverage_status: availability.coverageStatus,
                selectable: !availability.isBlocked,
                status_message: availability.reason
            }
        })

        return NextResponse.json({
            success: true,
            services: servicesWithAvailability,
            total: servicesWithAvailability.length
        })
    } catch (error) {
        console.error("Error fetching NHIA services:", error)
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch NHIA services"
            },
            { status: 500 }
        )
    }
}
