/**
 * GET /api/mobile/enrollee/coverage
 * Returns the covered services and package limits for the enrollee's plan.
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
  logToFile("[DEBUG] GET /api/mobile/enrollee/coverage - Starting");
  try {
    const session = await verifyMobileToken(req)
    if (!session || session.role !== "ENROLLEE") {
      logToFile("[DEBUG] Unauthorized coverage request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let plan_id: string | null = null

    // 1. Try Principal
    const principal = await prisma.principalAccount.findUnique({
      where: { id: session.id },
      select: { plan_id: true },
    })
    
    if (principal) {
      plan_id = principal.plan_id
    } else {
      // 2. Try Dependent
      const dependent = await prisma.dependent.findUnique({
        where: { id: session.id },
        include: { principal: { select: { plan_id: true } } },
      })
      if (dependent && dependent.principal) {
        plan_id = dependent.principal.plan_id
      }
    }

    if (!principal && !plan_id) {
      logToFile(`[DEBUG] Enrollee account not found for ID: ${session.id}`);
      return NextResponse.json({ error: "Enrollee account not found" }, { status: 404 })
    }

    if (!plan_id) {
      logToFile("[DEBUG] plan_id is null");
      return NextResponse.json({ coveredServices: [], packageLimits: [], plan: null })
    }

    // 1. Fetch Plan
    const planStart = Date.now();
    const plan = await prisma.plan.findUnique({
      where: { id: plan_id },
      select: {
        id: true,
        plan_id: true,
        name: true,
        description: true,
        plan_type: true,
        classification: true,
        premium_amount: true,
        annual_limit: true,
        status: true,
        coverage_details: true,
      },
    });
    logToFile(`[DEBUG] Plan fetch took: ${Date.now() - planStart}ms`);

    // 2. Fetch Covered Services (Sequential, without distinct for DB speed)
    const csStart = Date.now();
    const coveredServicesRaw = await prisma.coveredService.findMany({
      where: { plan_id: plan_id, status: "ACTIVE" },
      include: {
        service_type: {
          select: {
            service_id: true,
            service_name: true,
            service_category: true,
            service_type: true,
            nhia_price: true,
          },
        },
      },
      take: 1000, 
    });
    logToFile(`[DEBUG] CoveredServices raw fetch took: ${Date.now() - csStart}ms (count: ${coveredServicesRaw.length})`);

    // In-memory distinct to avoid DB distinct overhead on large tables
    const uniqueServices = new Map();
    for (const cs of coveredServicesRaw) {
      if (!uniqueServices.has(cs.service_type_id)) {
        uniqueServices.set(cs.service_type_id, cs);
      }
      if (uniqueServices.size >= 500) break;
    }
    const coveredServicesProcessed = Array.from(uniqueServices.values());
    logToFile(`[DEBUG] In-memory distinct took: ${Date.now() - csStart}ms (final count: ${coveredServicesProcessed.length})`);

    // 3. Fetch Package Limits (Existing)
    const plStart = Date.now();
    const packageLimits = await prisma.packageLimit.findMany({
      where: { plan_id: plan_id, status: "ACTIVE" },
      select: {
        id: true,
        category: true,
        service_name: true,
        amount: true,
        limit_type: true,
        limit_frequency: true,
        coverage_status: true,
        input_type: true,
      },
      orderBy: { category: "asc" },
    });
    logToFile(`[DEBUG] PackageLimits fetch took: ${Date.now() - plStart}ms`);

    // 4. Fetch Plan Limits (Newer/Alternative source from Underwriting Customize)
    const planLimitsData = await prisma.planLimit.findMany({
      where: { plan_id: plan_id },
      orderBy: { created_at: "asc" },
    });
    logToFile(`[DEBUG] PlanLimits fetch took: ${Date.now() - plStart}ms (count: ${planLimitsData.length})`);

    // Load category mapping to match category names to IDs (used for PlanLimits category_id)
    let categoryMap = new Map<string, string>();
    try {
      const categoriesPath = path.join(process.cwd(), 'public', 'plan_categories.json');
      if (fs.existsSync(categoriesPath)) {
        const categoriesData = fs.readFileSync(categoriesPath, 'utf-8');
        const categories = JSON.parse(categoriesData) as Array<{ id: string; name: string }>;
        categories.forEach(cat => categoryMap.set(cat.id, cat.name));
      }
    } catch (err) {
      logToFile(`[ERROR] Failed to load category mapping: ${err}`);
    }

    // If packageLimits is empty, let's try to populate it from planLimits + coveredServices
    let finalPackageLimits = [...packageLimits];
    if (finalPackageLimits.length === 0 && planLimitsData.length > 0) {
      // Map PlanLimit to PackageLimit structure for the mobile app
      // Categorized by category_id or service_category
      for (const pl of planLimitsData) {
        if (pl.limit_type === 'CATEGORY_PRICE' || pl.limit_type === 'CATEGORY_FREQUENCY') {
           const categoryName = pl.category_id ? (categoryMap.get(pl.category_id) || pl.category_id) : "General";
           finalPackageLimits.push({
             id: pl.id,
             category: categoryName,
             service_name: "Category Limit",
             amount: pl.price_limit ? Number(pl.price_limit) : pl.frequency_limit || 0,
             limit_type: pl.limit_type.includes('PRICE') ? 'PRICE' : 'FREQUENCY',
             limit_frequency: pl.frequency_limit ? `${pl.frequency_limit} Sessions` : null,
             coverage_status: 'COVERED',
             input_type: 'NUMBER'
           } as any);
        }
      }
    }

    // Also include active covered services as limits if they aren't already there
    if (finalPackageLimits.length === 0) {
      for (const cs of coveredServicesProcessed) {
        finalPackageLimits.push({
          id: cs.id,
          category: cs.service_type?.service_category || "General",
          service_name: cs.service_type?.service_name || "Unknown Service",
          amount: Number(cs.facility_price),
          limit_type: cs.limit_count ? 'FREQUENCY' : 'PRICE',
          limit_frequency: cs.limit_count ? `${cs.limit_count} Sessions` : null,
          coverage_status: 'COVERED',
          input_type: 'NUMBER'
        } as any);
      }
    }

    const coveredServices = coveredServicesProcessed.sort((a: any, b: any) => {
      const catA = a.service_type?.service_category ?? "";
      const catB = b.service_type?.service_category ?? "";
      return catA.localeCompare(catB);
    });

    await trackStatisticsEvent({
      event: "coverage_view",
      module: "enrolleeapp",
      stage: "coverage",
      outcome: "success",
      actorType: "enrollee",
      actorId: session.id,
      enrolleeId: session.enrollee_id || null,
      metadata: {
        planId: plan_id,
        coveredServicesCount: coveredServices.length,
        packageLimitsCount: finalPackageLimits.length,
      },
      req,
    })

    logToFile("[DEBUG] GET /api/mobile/enrollee/coverage - Success");
    return NextResponse.json({ plan, coveredServices, packageLimits: finalPackageLimits })
  } catch (error) {
    logToFile(`[ERROR] Coverage API: ${error}`);
    console.error("[MOBILE_ENROLLEE_COVERAGE]", error)
    await trackStatisticsEvent({
      event: "coverage_view",
      module: "enrolleeapp",
      stage: "coverage",
      outcome: "failed",
      actorType: "system",
      metadata: { reason: "server_error" },
      req,
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
