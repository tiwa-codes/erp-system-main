/**
 * GET /api/mobile/enrollee/providers/search?q=keyword
 * Allows enrollees to search active providers by facility name when submitting encounter code requests.
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

    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q") || ""

    if (q.length < 2) {
      return NextResponse.json({ providers: [] })
    }

    const providers = await prisma.provider.findMany({
      where: {
        status: "ACTIVE",
        facility_name: { contains: q, mode: "insensitive" },
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
      event: "provider_search",
      module: "enrolleeapp",
      stage: "provider_search",
      outcome: "success",
      actorType: "enrollee",
      actorId: session.id,
      enrolleeId: session.enrollee_id || null,
      metadata: {
        query: q,
        resultCount: providers.length,
      },
      req,
    })

    return NextResponse.json({ providers })
  } catch (error) {
    console.error("[MOBILE_ENROLLEE_PROVIDERS_SEARCH]", error)
    await trackStatisticsEvent({
      event: "provider_search",
      module: "enrolleeapp",
      stage: "provider_search",
      outcome: "failed",
      actorType: "system",
      metadata: { reason: "server_error" },
      req,
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
