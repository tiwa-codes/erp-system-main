import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileToken } from "@/lib/mobile-auth"

export async function GET(req: NextRequest) {
  try {
    const session = await verifyMobileToken(req)
    if (!session || session.role !== "ENROLLEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") || "PENDING"

    const updates = await prisma.mobileUpdate.findMany({
      where: {
        target: "PRINCIPAL",
        target_id: session.id,
        status: status as any
      },
      orderBy: { created_at: "desc" },
      take: 20
    })

    return NextResponse.json({
      success: true,
      data: updates
    })

  } catch (error) {
    console.error("[MOBILE_ENROLLEE_UPDATES_GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
