/**
 * GET /api/mobile/enrollee/providers
 * Returns all active healthcare providers for hospital selection.
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileToken } from "@/lib/mobile-auth"
import { trackStatisticsEvent } from "@/lib/statistics-events"

export async function GET(req: NextRequest) {
  try {
    const session = await verifyMobileToken(req)
    if (!session || session.role !== "ENROLLEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const providers = await prisma.provider.findMany({
      where: {
        status: "ACTIVE",
      },
      select: {
        id: true,
        facility_name: true,
        address: true,
        phone_whatsapp: true,
        practice: true,
        band: true,
      },
      take: 20,
      orderBy: { facility_name: "asc" },
    })

    await trackStatisticsEvent({
      event: "provider_list_view",
      module: "enrolleeapp",
      stage: "provider_discovery",
      outcome: "success",
      actorType: "enrollee",
      actorId: session.id,
      enrolleeId: session.enrollee_id || null,
      metadata: { resultCount: providers.length },
      req,
    })

    return NextResponse.json({ providers })
  } catch (error) {
    console.error("[MOBILE_ENROLLEE_PROVIDERS_LIST]", error)
    await trackStatisticsEvent({
      event: "provider_list_view",
      module: "enrolleeapp",
      stage: "provider_discovery",
      outcome: "failed",
      actorType: "system",
      metadata: { reason: "server_error" },
      req,
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
