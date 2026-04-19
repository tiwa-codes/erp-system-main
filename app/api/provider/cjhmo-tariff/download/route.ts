import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { readFile } from "fs/promises"
import path from "path"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [hasManagePermission, hasApprovePermission] = await Promise.all([
      checkPermission(session.user.role as any, "provider", "manage_tariff_plan"),
      checkPermission(session.user.role as any, "provider", "approve_tariff_plan"),
    ])

    if (!hasManagePermission && !hasApprovePermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const filePath = path.join(process.cwd(), "uploads", "tariff-files", "cjhmo-universal", "current.xlsx")
    const fileBuffer = await readFile(filePath)

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=\"cjhmo-universal-tariff.xlsx\"",
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: "No universal CJHMO tariff uploaded yet" },
      { status: 404 }
    )
  }
}
