import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const providerId = searchParams.get("providerId")
        const categoryId = searchParams.get("categoryId")

        if (!providerId) {
            return NextResponse.json(
                { error: "Provider ID is required" },
                { status: 400 }
            )
        }

        if (!categoryId) {
            return NextResponse.json(
                { error: "Category ID is required" },
                { status: 400 }
            )
        }

        // Fetch tariff plan services for this provider and category
        const services = await prisma.tariffPlanService.findMany({
            where: {
                provider_id: providerId,
                category_id: categoryId
            },
            orderBy: {
                service_name: 'asc'
            }
        })

        if (services.length === 0) {
            return NextResponse.json(
                { error: "No services found for this category" },
                { status: 404 }
            )
        }

        // Prepare data for Excel
        const excelData = services.map(service => ({
            "Service Name": service.service_name,
            "Service Category": service.category_name,
            "Service Type": service.service_type || 2,
            "Price": service.price
        }))

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

        // Get category name for filename
        const categoryName = services[0]?.category_name || categoryId

        // Return as downloadable file
        return new NextResponse(buf, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="tariff_plan_${categoryName}_${new Date().toISOString().split('T')[0]}.xlsx"`
            }
        })
    } catch (error) {
        console.error("Error exporting category services:", error)
        return NextResponse.json(
            { error: "Failed to export category services" },
            { status: 500 }
        )
    }
}
