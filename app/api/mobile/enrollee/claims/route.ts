/**
 * GET /api/mobile/enrollee/claims
 * Returns paginated claims for the authenticated enrollee with provider details and usage summary.
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileToken } from "@/lib/mobile-auth"
import { trackStatisticsEvent } from "@/lib/statistics-events"
import fs from "fs"
import path from "path"

const logFile = path.join(process.cwd(), "tmp", "api_logs.txt");
if (!fs.existsSync(path.dirname(logFile))) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
}

function logToFile(msg: string) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
}

export async function GET(req: NextRequest) {
  logToFile("[DEBUG] GET /api/mobile/enrollee/claims - Starting");
  try {
    const session = await verifyMobileToken(req)
    if (!session || session.role !== "ENROLLEE") {
      logToFile("[DEBUG] Unauthorized claims request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let where: any = {}

    // 1. Try Principal
    const principal = await prisma.principalAccount.findUnique({
      where: { id: session.id },
      select: { id: true },
    })
    
    if (principal) {
      // Principal sees family claims (everything linked to their principal_id)
      where = { principal_id: principal.id }
    } else {
      // 2. Try Dependent
      const dependent = await prisma.dependent.findUnique({
        where: { id: session.id },
        select: { dependent_id: true, principal_id: true },
      })
      if (dependent) {
        // Dependent only sees their OWN claims
        where = { 
          principal_id: dependent.principal_id,
          enrollee_id: dependent.dependent_id
        }
      } else {
        logToFile(`[DEBUG] Enrollee account not found for ID: ${session.id}`);
        return NextResponse.json({ error: "Enrollee account not found" }, { status: 404 })
      }
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10")))
    const skip = (page - 1) * limit

    // Sequential queries with timing
    const countStart = Date.now();
    const total = await prisma.claim.count({ where });
    logToFile(`[DEBUG] Claims count took: ${Date.now() - countStart}ms`);

    const findStart = Date.now();
    const claims = await prisma.claim.findMany({
      where,
      skip,
      take: limit,
      orderBy: { submitted_at: "desc" },
      select: {
        id: true,
        claim_number: true,
        amount: true,
        approved_amount: true,
        status: true,
        claim_type: true,
        submitted_at: true,
        description: true,
        provider: {
          select: {
            id: true,
            facility_name: true,
            address: true,
            phone_whatsapp: true,
          },
        },
      },
    });
    logToFile(`[DEBUG] Claims findMany took: ${Date.now() - findStart}ms (count: ${claims.length})`);

    const aggStart = Date.now();
    const totalUsedAgg = await prisma.claim.aggregate({
      where,
      _sum: { amount: true },
    });
    logToFile(`[DEBUG] Claims aggregate took: ${Date.now() - aggStart}ms`);

    const totalPages = Math.ceil(total / limit)

    await trackStatisticsEvent({
      event: "claims_view",
      module: "claims",
      stage: "claims_list",
      outcome: "success",
      actorType: "enrollee",
      actorId: session.id,
      enrolleeId: session.enrollee_id || null,
      metadata: { total, page, limit, returned: claims.length },
      req,
    })

    logToFile("[DEBUG] GET /api/mobile/enrollee/claims - Success")
    return NextResponse.json({
      claims: (claims ?? []).map((c) => ({
        ...c,
        amount: c.amount?.toString() ?? "0",
        approved_amount: c.approved_amount?.toString() ?? null,
      })),
      pagination: { page, limit, total, totalPages },
      summary: {
        total_used: totalUsedAgg._sum.amount?.toString() ?? "0",
      },
    })
  } catch (error) {
    logToFile(`[ERROR] Claims API: ${error}`);
    console.error("[MOBILE_ENROLLEE_CLAIMS]", error)
    await trackStatisticsEvent({
      event: "claims_view",
      module: "claims",
      stage: "claims_list",
      outcome: "failed",
      actorType: "system",
      metadata: { reason: "server_error" },
      req,
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
