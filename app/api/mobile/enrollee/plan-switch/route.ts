/**
 * POST /api/mobile/enrollee/plan-switch
 * Enrollees can request a plan switch.
 * This creates a MobileUpdate record with target=PRINCIPAL and type=PLAN_SWITCH.
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileToken } from "@/lib/mobile-auth"

export async function POST(req: NextRequest) {
  try {
    const session = await verifyMobileToken(req)
    if (!session || session.role !== "ENROLLEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { new_plan_id, reason } = await req.json()

    if (!new_plan_id) {
      return NextResponse.json({ error: "new_plan_id is required" }, { status: 400 })
    }

    // 1. Verify enrollee exists and check for existing pending switch
    const [principal, existingUpdate] = await Promise.all([
      prisma.principalAccount.findUnique({
        where: { id: session.id },
        select: { id: true, enrollee_id: true, plan_id: true }
      }),
      prisma.mobileUpdate.findFirst({
        where: {
          target: "PRINCIPAL",
          target_id: session.id,
          status: "PENDING",
          payload: { path: ["type"], equals: "PLAN_SWITCH" }
        }
      })
    ])

    if (existingUpdate) {
      return NextResponse.json({ error: "You already have a pending plan switch request" }, { status: 400 })
    }

    if (!principal) {
      return NextResponse.json({ error: "Enrollee not found" }, { status: 404 })
    }

    // 2. Verify new plan exists and is ACTIVE
    const newPlan = await prisma.plan.findUnique({
      where: { id: new_plan_id, status: "ACTIVE" },
      select: { id: true, name: true, premium_amount: true }
    })

    if (!newPlan) {
      return NextResponse.json({ error: "Selected plan is invalid or not active" }, { status: 400 })
    }

    // 3. Prevent switching to the same plan
    if (principal.plan_id === new_plan_id) {
      return NextResponse.json({ error: "You are already on this plan" }, { status: 400 })
    }

    // 4. Create MobileUpdate record
    const update = await prisma.mobileUpdate.create({
      data: {
        target: "PRINCIPAL",
        target_id: principal.id,
        payload: {
          type: "PLAN_SWITCH",
          new_plan_id: newPlan.id,
          new_plan_name: newPlan.name,
          premium_amount: newPlan.premium_amount.toString(),
          reason: reason || "Plan switch requested via mobile app",
        },
        status: "PENDING",
        source: "MOBILE_APP",
      },
    })

    return NextResponse.json({
      message: "Plan switch request submitted successfully",
      update_id: update.id,
    })

  } catch (error) {
    console.error("[MOBILE_PLAN_SWITCH]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
