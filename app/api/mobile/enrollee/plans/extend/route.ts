/**
 * POST /api/mobile/enrollee/plans/extend
 * Creates a MobileUpdate request for underwriting review.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMobileToken } from "@/lib/mobile-auth";

export async function POST(req: NextRequest) {
  try {
    const session = await verifyMobileToken(req);
    if (!session || session.role !== "ENROLLEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { plan_name, plan_description, services, reason } = body;

    if (!services || !Array.isArray(services) || services.length === 0) {
      return NextResponse.json({ error: "Missing or invalid services" }, { status: 400 });
    }

    // Identify principal and organization (dependents route through their principal)
    let principal_id = session.id;
    let organization_id = null;

    // 1. Try Principal
    const principal = await prisma.principalAccount.findUnique({
      where: { id: session.id },
      select: { organization_id: true },
    });

    if (principal) {
      organization_id = principal.organization_id;
    } else {
      // 2. Try Dependent
      const dependent = await prisma.dependent.findUnique({
        where: { id: session.id },
        include: { principal: { select: { id: true, organization_id: true } } },
      });
      if (dependent && dependent.principal) {
        principal_id = dependent.principal.id;
        organization_id = dependent.principal.organization_id;
      }
    }

    if (!organization_id) {
      return NextResponse.json({ error: "Organization not found for enrollee" }, { status: 404 });
    }

    const [principalProfile, existingPending] = await Promise.all([
      prisma.principalAccount.findUnique({
        where: { id: principal_id },
        select: {
          id: true,
          enrollee_id: true,
          first_name: true,
          last_name: true,
        },
      }),
      prisma.mobileUpdate.findFirst({
        where: {
          target: "PRINCIPAL",
          target_id: principal_id,
          status: "PENDING",
          payload: {
            path: ["type"],
            equals: "PLAN_EXTENSION",
          },
        },
        select: { id: true },
      }),
    ]);

    if (!principalProfile) {
      return NextResponse.json({ error: "Principal profile not found" }, { status: 404 });
    }

    if (existingPending) {
      return NextResponse.json(
        { error: "You already have a pending plan extension request" },
        { status: 400 }
      );
    }

    const update = await prisma.mobileUpdate.create({
      data: {
        target: "PRINCIPAL",
        target_id: principal_id,
        status: "PENDING",
        source: "MOBILE_APP",
        payload: {
          type: "PLAN_EXTENSION",
          plan_name: plan_name || "Plan Extension",
          plan_description: plan_description || "Requested via mobile app",
          reason: reason || "Plan extension request via mobile app",
          requested_by: {
            id: session.id,
            role: session.role,
          },
          principal: {
            id: principalProfile.id,
            enrollee_id: principalProfile.enrollee_id,
            full_name: `${principalProfile.first_name} ${principalProfile.last_name}`,
          },
          organization_id,
          services,
        },
      },
    });

    return NextResponse.json({
      message: "Plan extension request submitted for underwriting review",
      update_id: update.id,
    });
  } catch (error) {
    console.error("[PLAN_EXTENSION_API]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
