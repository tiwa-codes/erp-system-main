/**
 * GET  /api/mobile/enrollee/medical-history   — fetch current record
 * PATCH /api/mobile/enrollee/medical-history  — request an update (creates MobileUpdate)
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileToken } from "@/lib/mobile-auth"

export async function GET(req: NextRequest) {
  try {
    const session = await verifyMobileToken(req)
    if (!session || session.role !== "ENROLLEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const principal = await prisma.principalAccount.findUnique({
      where: { id: session.id },
      select: { id: true, medical_history: true },
    })

    if (!principal) {
      return NextResponse.json({ error: "Enrollee account not found" }, { status: 404 })
    }

    return NextResponse.json({ medicalHistory: principal.medical_history })
  } catch (error) {
    console.error("[MOBILE_MEDICAL_HISTORY_GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
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

    const payload = await req.json()
    // payload shape: Partial<MedicalHistory boolean flags> + optional disease_comments

    const update = await prisma.mobileUpdate.create({
      data: {
        target: "PRINCIPAL",
        target_id: principal.id,
        payload: { type: "MEDICAL_HISTORY", ...payload },
        status: "PENDING",
        source: "MOBILE_APP",
        created_by_id: null, // enrollees authenticate via OTP, no User record required
      },
    })

    return NextResponse.json({
      message: "Medical history update request submitted for review",
      update_id: update.id,
    })
  } catch (error) {
    console.error("[MOBILE_MEDICAL_HISTORY_PATCH]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
