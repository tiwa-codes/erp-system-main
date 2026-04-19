import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has reports permissions
    const hasPermission = await checkPermission(session.user.role as any, "reports", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Get recent reports (last 10)
    const reports = await prisma.report.findMany({
      take: 10,
      orderBy: { generated_at: "desc" },
      include: {
        generated_by: {
          select: {
            first_name: true,
            last_name: true
          }
        }
      }
    })

    // Format reports data
    const formattedReports = reports.map(report => ({
      id: report.id,
      report_name: report.report_name,
      report_type: report.report_type,
      status: report.status,
      generated_at: report.generated_at.toISOString(),
      generated_by: `${report.generated_by.first_name} ${report.generated_by.last_name}`,
      file_path: report.file_path,
      error_message: report.error_message
    }))

    return NextResponse.json({
      success: true,
      reports: formattedReports
    })

  } catch (error) {
    console.error("Error fetching recent reports:", error)
    return NextResponse.json(
      { error: "Failed to fetch recent reports" },
      { status: 500 }
    )
  }
}
