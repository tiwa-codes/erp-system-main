/**
 * GET /api/mobile/enrollee/encounter-code/status
 * Returns all ProviderRequests submitted by this enrollee via mobile.
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

    const principal = await prisma.principalAccount.findUnique({
      where: { id: session.id },
      select: { id: true },
    })

    if (!principal) {
      return NextResponse.json({ error: "Enrollee account not found" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const skip = (page - 1) * limit

    const [requests, total] = await Promise.all([
      prisma.providerRequest.findMany({
        where: { enrollee_id: principal.id },
        include: {
          request_items: {
            select: {
              id: true,
              service_name: true,
              service_amount: true,
              quantity: true,
              category: true,
            },
          },
          provider: {
            select: {
              id: true,
              facility_name: true,
              address: true,
              phone_whatsapp: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.providerRequest.count({ where: { enrollee_id: principal.id } }),
    ])

    await trackStatisticsEvent({
      event: "encounter_status_view",
      module: "enrolleeapp",
      stage: "encounter_request",
      outcome: "success",
      actorType: "enrollee",
      actorId: session.id,
      enrolleeId: session.enrollee_id || null,
      metadata: { total, page, limit },
      req,
    })

    return NextResponse.json({
      requests,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error("[MOBILE_ENCOUNTER_STATUS]", error)
    await trackStatisticsEvent({
      event: "encounter_status_view",
      module: "enrolleeapp",
      stage: "encounter_request",
      outcome: "failed",
      actorType: "system",
      metadata: { reason: "server_error" },
      req,
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
