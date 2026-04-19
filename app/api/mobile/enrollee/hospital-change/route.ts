/**
 * POST /api/mobile/enrollee/hospital-change
 * Submits a request to change the enrollee's primary hospital.
 * Creates a MobileUpdate record for review by Underwriting.
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

    const body = await req.json()
    const { provider_id, reason } = body

    if (!provider_id) {
      return NextResponse.json({ error: "provider_id is required" }, { status: 400 })
    }

    // Verify hospital exists and is active
    const provider = await prisma.provider.findUnique({
      where: { id: provider_id },
      select: { id: true, facility_name: true, address: true }
    })

    if (!provider) {
      return NextResponse.json({ error: "Selected hospital not found" }, { status: 404 })
    }

    // Check for existing pending request of same type
    const existingPending = await prisma.mobileUpdate.findFirst({
      where: {
        target_id: session.id,
        status: "PENDING",
        payload: {
          path: ["type"],
          equals: "HCP_CHANGE"
        }
      }
    })

    if (existingPending) {
      return NextResponse.json(
        { error: "You already have a pending hospital change request" },
        { status: 400 }
      )
    }

    // Create the update request
    const update = await prisma.mobileUpdate.create({
      data: {
        target: "PRINCIPAL",
        target_id: session.id,
        status: "PENDING",
        source: "MOBILE_APP",
        payload: {
          type: "HCP_CHANGE",
          new_hospital_id: provider.id,
          new_hospital_name: provider.facility_name,
          new_hospital_address: provider.address,
          reason: reason || "Hospital change request via mobile app"
        }
      }
    })

    return NextResponse.json({
      message: "Hospital change request submitted for review",
      update_id: update.id
    })

  } catch (error) {
    console.error("[MOBILE_ENROLLEE_HOSPITAL_CHANGE]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
