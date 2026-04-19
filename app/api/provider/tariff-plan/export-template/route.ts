import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const providerId = searchParams.get("providerId")

        // Fetch all service types from Settings → Service Types
        const serviceTypes = await prisma.serviceType.findMany({
            orderBy: [
                { service_category: 'asc' },
                { service_name: 'asc' }
            ]
        })

        if (serviceTypes.length === 0) {
            return NextResponse.json(
                { error: "No service types found" },
                { status: 404 }
            )
        }

        // If providerId is provided, get existing tariff plan services to pre-fill prices and types
        let existingServices: Record<string, { price: number; service_type: number }> = {}
        if (providerId) {
            const tariffServices = await prisma.tariffPlanService.findMany({
                where: { provider_id: providerId },
                select: {
                    service_id: true,
                    price: true,
                    service_type: true
                }
            })

            existingServices = tariffServices.reduce((acc, service) => {
                acc[service.service_id] = {
                    price: service.price,
                    service_type: service.service_type || 2
                }
                return acc
            }, {} as Record<string, { price: number; service_type: number }>)
        }

        // Prepare data for Excel
        const excelData = serviceTypes.map(service => {
            const existing = existingServices[service.service_id]
            return {
                "Service Name": service.service_name,
                "Service Category": service.service_category,
                "Service Type": existing?.service_type || 2, // Default to 2 (Secondary)
                "Price": existing?.price || 0
            }
        })

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(excelData)

        // Set column widths
        ws['!cols'] = [
            { wch: 40 }, // Service Name
            { wch: 25 }, // Service Category
            { wch: 15 }, // Service Type
            { wch: 15 }  // Price
        ]

        XLSX.utils.book_append_sheet(wb, ws, "Services")

        // Generate buffer
        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

        // Return as downloadable file
        return new NextResponse(buf, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="tariff_plan_template_${new Date().toISOString().split('T')[0]}.xlsx"`
            }
        })
    } catch (error) {
        console.error("Error generating export template:", error)
        return NextResponse.json(
            { error: "Failed to generate export template" },
            { status: 500 }
        )
    }
}
