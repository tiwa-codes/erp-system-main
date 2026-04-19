import { NextResponse } from "next/server"
import * as XLSX from "xlsx"

export async function GET() {
  try {
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Service Name", "Service Price"],
      ["General Consultation", 5000],
      ["Specialist Consultation", 10000],
    ])

    XLSX.utils.book_append_sheet(workbook, worksheet, "Tariff Sample")
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="tariff-upload-sample.xlsx"',
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("Failed to generate tariff upload sample:", error)
    return NextResponse.json({ error: "Failed to generate sample file" }, { status: 500 })
  }
}
