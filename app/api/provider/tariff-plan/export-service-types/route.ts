import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import * as XLSX from "xlsx"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permissions - allow both provider and provider management team
    const hasTariffPermission = await checkPermission(
      session.user.role as any,
      "provider",
      "manage_tariff_plan"
    )
    const hasSettingsPermission = await checkPermission(
      session.user.role as any,
      "settings",
      "view"
    )

    if (!hasTariffPermission && !hasSettingsPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format") || "xlsx" // xlsx or csv

    // Fetch all service types from Settings
    const serviceTypes = await prisma.serviceType.findMany({
      orderBy: {
        service_name: "asc",
      },
    })

    if (serviceTypes.length === 0) {
      return NextResponse.json(
        { error: "No service types found" },
        { status: 404 }
      )
    }

    // Prepare data for export
    const exportData = [
      ["Service ID", "Service Name", "Service Category", "Tariff Price"], // Header
      ...serviceTypes.map((service) => [
        service.service_id,
        service.service_name,
        service.service_category,
        "", // Empty Tariff Price column
      ]),
    ]

    if (format === "csv") {
      // Generate CSV
      const csvContent = exportData
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n")

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="service-types-template-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      })
    } else {
      // Generate Excel
      const worksheet = XLSX.utils.aoa_to_sheet(exportData)

      // Set column widths
      worksheet["!cols"] = [
        { wch: 15 }, // Service ID
        { wch: 40 }, // Service Name
        { wch: 25 }, // Service Category
        { wch: 15 }, // Tariff Price
      ]

      // Style header row
      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1")
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
        if (!worksheet[cellAddress]) continue
        worksheet[cellAddress].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "E5E7EB" } },
        }
      }

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Service Types")

      // Generate buffer
      const excelBuffer = XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      })

      return new NextResponse(excelBuffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="service-types-template-${new Date().toISOString().split("T")[0]}.xlsx"`,
        },
      })
    }
  } catch (error) {
    console.error("Error exporting service types:", error)
    return NextResponse.json(
      { error: "Failed to export service types" },
      { status: 500 }
    )
  }
}

