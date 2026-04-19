import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import * as XLSX from "xlsx"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function normalizeSheetName(name: string) {
  return name.replace(/[\\/*?:[\]]/g, "").slice(0, 31) || "Category"
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get("providerId")

    if (!providerId) {
      return NextResponse.json({ error: "Provider ID is required" }, { status: 400 })
    }

    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      select: { facility_name: true },
    })

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
    }

    const services = await prisma.tariffPlanService.findMany({
      where: { provider_id: providerId },
      orderBy: [{ category_name: "asc" }, { service_name: "asc" }],
      select: {
        service_id: true,
        service_name: true,
        category_id: true,
        category_name: true,
        service_type: true,
        price: true,
        status: true,
      },
    })

    if (!services.length) {
      return NextResponse.json({ error: "No tariff services found for this provider" }, { status: 404 })
    }

    const workbook = XLSX.utils.book_new()

    const allRows = services.map((service) => ({
      "Category ID": service.category_id || "",
      Category: service.category_name || "Uncategorized",
      "Service ID": service.service_id || "",
      "Service Name": service.service_name || "",
      "Service Type": service.service_type === 1 ? "Primary" : "Secondary",
      Price: service.price ?? 0,
      Status: service.status || "ACTIVE",
    }))

    const allSheet = XLSX.utils.json_to_sheet(allRows)
    allSheet["!cols"] = [
      { wch: 14 },
      { wch: 28 },
      { wch: 18 },
      { wch: 40 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
    ]
    XLSX.utils.book_append_sheet(workbook, allSheet, "All Tariffs")

    const groupedByCategory = services.reduce<Record<string, typeof services>>((acc, service) => {
      const category = service.category_name || "Uncategorized"
      if (!acc[category]) acc[category] = []
      acc[category].push(service)
      return acc
    }, {})

    for (const [categoryName, categoryServices] of Object.entries(groupedByCategory)) {
      const rows = categoryServices.map((service) => ({
        "Category ID": service.category_id || "",
        "Service ID": service.service_id || "",
        "Service Name": service.service_name || "",
        "Service Type": service.service_type === 1 ? "Primary" : "Secondary",
        Price: service.price ?? 0,
        Status: service.status || "ACTIVE",
      }))

      const sheet = XLSX.utils.json_to_sheet(rows)
      sheet["!cols"] = [
        { wch: 14 },
        { wch: 18 },
        { wch: 40 },
        { wch: 14 },
        { wch: 14 },
        { wch: 12 },
      ]
      XLSX.utils.book_append_sheet(workbook, sheet, normalizeSheetName(categoryName))
    }

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
    const dateTag = new Date().toISOString().split("T")[0]
    const providerNameTag = provider.facility_name?.replace(/[^a-zA-Z0-9]+/g, "_") || "provider"

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=\"tariff_${providerNameTag}_${dateTag}.xlsx\"`,
      },
    })
  } catch (error) {
    console.error("Error exporting provider tariff:", error)
    return NextResponse.json({ error: "Failed to export provider tariff" }, { status: 500 })
  }
}
