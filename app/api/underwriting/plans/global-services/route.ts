import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Get search parameter from query
        const { searchParams } = new URL(request.url)
        const search = searchParams.get("search")?.trim()

        const where: any = {
            status: 'ACTIVE',
            is_draft: false
        }
        
        if (search) {
            where.OR = [
                { service_name: { contains: search, mode: 'insensitive' } },
                { category_name: { contains: search, mode: 'insensitive' } },
            ]
        }

        const allServices = await prisma.tariffPlanService.findMany({
            where,
            select: {
                service_id: true,
                service_name: true,
                category_name: true,
                price: true,
                service_type: true
            },
            orderBy: [
                { category_name: 'asc' },
                { service_name: 'asc' }
            ]
        })

        const uniqueServicesMap = new Map<string, {
            submitted_service_id: string
            service_name: string
            service_category: string
            service_type: string | null
            price: any
        }>()

        allServices.forEach(service => {
            if (!uniqueServicesMap.has(service.service_id)) {
                uniqueServicesMap.set(service.service_id, {
                    submitted_service_id: service.service_id,
                    service_name: service.service_name,
                    service_category: service.category_name,
                    service_type: service.service_type,
                    price: service.price
                })
            }
        })

        const uniqueServices = Array.from(uniqueServicesMap.values())
        const submittedIds = uniqueServices.map(service => service.submitted_service_id)
        const serviceNames = uniqueServices.map(service => service.service_name)

        const serviceTypes = await prisma.serviceType.findMany({
            where: {
                OR: [
                    { service_id: { in: submittedIds } },
                    { service_name: { in: serviceNames } },
                ]
            },
            select: {
                id: true,
                service_id: true,
                service_name: true,
                service_category: true,
                service_type: true,
            }
        })

        const normalizeValue = (value?: string | null) =>
            (value || "")
                .toString()
                .trim()
                .toLowerCase()
                .replace(/&/g, "and")
                .replace(/[^a-z0-9]+/g, " ")
                .replace(/\s+/g, " ")
                .trim()

        const serviceTypeByServiceId = new Map(serviceTypes.map((serviceType) => [serviceType.service_id, serviceType]))
        const serviceTypeByName = new Map(serviceTypes.map((serviceType) => [normalizeValue(serviceType.service_name), serviceType]))

        const services = uniqueServices.map((service) => {
            const matchedServiceType =
                serviceTypeByServiceId.get(service.submitted_service_id) ||
                serviceTypeByName.get(normalizeValue(service.service_name))

            return {
                id: matchedServiceType?.id || service.submitted_service_id,
                service_id: matchedServiceType?.service_id || service.submitted_service_id,
                service_name: matchedServiceType?.service_name || service.service_name,
                service_category: service.service_category,
                service_type: matchedServiceType?.service_type || service.service_type,
                price: service.price
            }
        })

        console.log(`[Global Services] Found ${services.length} distinct ACTIVE services from TariffPlanService`)
        if (search) {
            console.log(`[Global Services] Search term: "${search}"`)
        }

        return NextResponse.json({ services })

    } catch (error) {
        console.error("Error fetching global services:", error)
        return NextResponse.json(
            { error: "Failed to fetch global services" },
            { status: 500 }
        )
    }
}
