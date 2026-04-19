/**
 * GET /api/mobile/enrollee/id-card
 * Returns URL/data for the enrollee's digital ID card.
 * Proxies the existing /api/id-card endpoint logic.
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileToken } from "@/lib/mobile-auth"
import fs from "fs"
import path from "path"

const logFile = path.join(process.cwd(), "tmp", "api_logs.txt");
function logToFile(msg: string) {
  const timestamp = new Date().toISOString();
  try {
    fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
  } catch (e) {}
}

export async function GET(req: NextRequest) {
  logToFile("[DEBUG] GET /api/mobile/enrollee/id-card - Starting");
  try {
    const session = await verifyMobileToken(req)
    if (!session || session.role !== "ENROLLEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const startPrincipal = Date.now();
    let principalAccount = await prisma.principalAccount.findUnique({
      where: { id: session.id },
      include: {
        organization: { select: { name: true, code: true } },
        plan: { select: { name: true, plan_type: true } },
        dependents: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            dependent_id: true,
            first_name: true,
            last_name: true,
            relationship: true,
            date_of_birth: true,
            gender: true,
            profile_picture: true,
          },
        },
      },
    })

    if (!principalAccount) {
      // Try Dependent
      const dependent = await prisma.dependent.findUnique({
        where: { id: session.id },
        include: {
          principal: {
            include: {
              organization: { select: { name: true, code: true } },
              plan: { select: { name: true, plan_type: true } },
              dependents: {
                where: { status: "ACTIVE" },
                select: {
                  id: true,
                  dependent_id: true,
                  first_name: true,
                  last_name: true,
                  relationship: true,
                  date_of_birth: true,
                  gender: true,
                  profile_picture: true,
                },
              },
            },
          },
        },
      })

      if (dependent && dependent.principal) {
        // Map dependent's context into the response, but use principal's plan/org/family
        principalAccount = {
          ...dependent.principal,
          // We can choose to keep principal's info or override with dependent's for the "primary" card
          // but usually the ID card API returns the family context.
        } as any
      }
    }

    if (!principalAccount) {
      return NextResponse.json({ error: "Enrollee account not found" }, { status: 404 })
    }

    const principal = principalAccount;

    logToFile("[DEBUG] GET /api/mobile/enrollee/id-card - Success")
    return NextResponse.json({
      idCard: {
        enrolleeId: principal.enrollee_id,
        fullName: `${principal.first_name} ${principal.last_name}`,
        dateOfBirth: principal.date_of_birth,
        gender: principal.gender,
        organization: principal.organization?.name,
        organizationCode: principal.organization?.code,
        plan: principal.plan?.name,
        planType: principal.plan?.plan_type,
        primaryHospital: principal.primary_hospital,
        startDate: principal.start_date,
        endDate: principal.end_date,
        status: principal.status,
        profilePicture: principal.profile_picture,
        dependents: principal.dependents,
      },
    })
  } catch (error) {
    logToFile(`[ERROR] ID Card API: ${error}`);
    console.error("[MOBILE_ENROLLEE_ID_CARD]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
