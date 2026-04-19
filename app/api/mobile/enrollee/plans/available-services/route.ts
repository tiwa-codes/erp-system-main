/**
 * GET /api/mobile/enrollee/plans/available-services
 * Returns a list of all available services that can be added to an extension request.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { trackStatisticsEvent } from "@/lib/statistics-events";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyMobileToken(req);
    if (!session || session.role !== "ENROLLEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "50");

    // Fetch global services with optional search
    const services = await prisma.serviceType.findMany({
      where: q ? {
        OR: [
          { service_name: { contains: q, mode: "insensitive" } },
          { service_category: { contains: q, mode: "insensitive" } },
        ],
      } : {},
      select: {
        id: true,
        service_id: true,
        service_name: true,
        service_category: true,
        nhia_price: true,
      },
      orderBy: [
        { service_category: "asc" },
        { service_name: "asc" },
      ],
      take: limit,
    });

    await trackStatisticsEvent({
      event: "available_services_view",
      module: "enrolleeapp",
      stage: "plan_extension",
      outcome: "success",
      actorType: "enrollee",
      actorId: session.id,
      enrolleeId: session.enrollee_id || null,
      metadata: {
        query: q || null,
        resultCount: services.length,
        limit,
      },
      req,
    });

    return NextResponse.json({ services });
  } catch (error) {
    console.error("[AVAILABLE_SERVICES_API]", error);
    await trackStatisticsEvent({
      event: "available_services_view",
      module: "enrolleeapp",
      stage: "plan_extension",
      outcome: "failed",
      actorType: "system",
      metadata: { reason: "server_error" },
      req,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
