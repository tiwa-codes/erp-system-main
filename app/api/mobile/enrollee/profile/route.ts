/**
 * GET /api/mobile/enrollee/profile
 * Returns the PrincipalAccount + Organization + Plan for the logged-in enrollee.
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
  logToFile("[DEBUG] GET /api/mobile/enrollee/profile - Starting");
  try {
    const session = await verifyMobileToken(req)
    if (!session || session.role !== "ENROLLEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const startProfile = Date.now();
    
    // 1. Try Principal
    let principal = await prisma.principalAccount.findUnique({
      where: { id: session.id },
      include: {
        organization: {
          select: { id: true, name: true, code: true, type: true, status: true },
        },
        plan: {
          select: { id: true, plan_id: true, name: true, description: true, plan_type: true, classification: true, premium_amount: true, annual_limit: true, status: true },
        },
        dependents: {
          select: { id: true, dependent_id: true, first_name: true, last_name: true, relationship: true, date_of_birth: true, status: true, profile_picture: true },
        },
      },
    })

    if (principal) {
      logToFile(`[DEBUG] Profile principal fetch took: ${Date.now() - startProfile}ms`);
      return NextResponse.json({ principal })
    }

    // 2. Try Dependent
    const dependent = await prisma.dependent.findUnique({
      where: { id: session.id },
      include: {
        principal: {
          include: {
            organization: {
              select: { id: true, name: true, code: true, type: true, status: true },
            },
            plan: {
              select: { id: true, plan_id: true, name: true, description: true, plan_type: true, classification: true, premium_amount: true, annual_limit: true, status: true },
            },
          }
        }
      }
    })

    if (dependent) {
      logToFile(`[DEBUG] Profile dependent fetch took: ${Date.now() - startProfile}ms`);
      
      // Fetch "siblings" (other dependents of the same principal)
      const familyDependents = await prisma.dependent.findMany({
        where: { 
          principal_id: dependent.principal_id,
          id: { not: dependent.id } // Exclude current dependent from the list if desired, or keep all
        },
        select: { id: true, dependent_id: true, first_name: true, last_name: true, relationship: true, date_of_birth: true, status: true, profile_picture: true },
      })

      // Construct a "pseudo-principal" object for the dependent so the frontend works similarly
      const pseudoPrincipal = {
        ...dependent.principal,
        id: dependent.id, // Use dependent's own ID
        enrollee_id: dependent.dependent_id,
        first_name: dependent.first_name,
        last_name: dependent.last_name,
        middle_name: dependent.middle_name,
        gender: dependent.gender,
        date_of_birth: dependent.date_of_birth,
        phone_number: dependent.phone_number,
        email: dependent.email,
        residential_address: dependent.residential_address,
        profile_picture: dependent.profile_picture,
        status: dependent.status,
        is_dependent: true,
        principal_account_id: dependent.principal_id,
        dependents: familyDependents, // Now they can see their family members
      }

      return NextResponse.json({ principal: pseudoPrincipal })
    }

    return NextResponse.json({ error: "Enrollee account not found" }, { status: 404 })
  } catch (error) {
    console.error("[MOBILE_ENROLLEE_PROFILE]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/mobile/enrollee/profile
 * Creates a MobileUpdate record for profile change request (reviewed by Underwriting).
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await verifyMobileToken(req)
    if (!session || session.role !== "ENROLLEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const principal = await prisma.principalAccount.findUnique({
      where: { id: session.id },
      select: { id: true, enrollee_id: true },
    })

    if (!principal) {
      return NextResponse.json({ error: "Enrollee account not found" }, { status: 404 })
    }

    const payload = await req.json()

    const update = await prisma.mobileUpdate.create({
      data: {
        target: "PRINCIPAL",
        target_id: principal.id,
        payload,
        status: "PENDING",
        source: "MOBILE_APP",
        created_by_id: null,
      },
    })

    return NextResponse.json({
      message: "Profile update request submitted for review",
      update_id: update.id,
    })
  } catch (error) {
    console.error("[MOBILE_ENROLLEE_PROFILE_UPDATE]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
