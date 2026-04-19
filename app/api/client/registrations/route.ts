import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildClientPlanOwnerWhere, getClientOwnership } from "@/lib/client-account"

function requireClientRole(role?: string) {
  return role?.toUpperCase() === "GUEST_OR_CLIENT"
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return {
    first_name: parts[0] || "",
    last_name: parts.slice(1).join(" ") || "",
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!requireClientRole(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const registrations = await prisma.principalRegistration.findMany({
      where: {
        source: {
          startsWith: `CLIENT_PORTAL_${session.user.id}`,
        },
      },
      orderBy: { submitted_at: "desc" },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
        status: true,
        organization_name: true,
        plan_name: true,
        submitted_at: true,
        reviewed_at: true,
      },
    })

    return NextResponse.json({ data: registrations }, { status: 200 })
  } catch (error) {
    console.error("Client registrations fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch registration status" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!requireClientRole(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const ownership = await getClientOwnership(session.user.id)
    const ownerWhere = buildClientPlanOwnerWhere(ownership)

    if (!ownerWhere || !ownership.organizationId || !ownership.organizationName || !ownership.organizationCode) {
      return NextResponse.json({ error: "Client account profile not found" }, { status: 404 })
    }

    const body = await request.json()

    const registerFor = String(body.register_for || "SELF").toUpperCase()
    const fullName = String(body.full_name || "").trim()
    const email = String(body.email || "").trim().toLowerCase()
    const phone = String(body.phone_number || "").trim()
    const gender = String(body.gender || "").trim().toUpperCase()
    const dateOfBirth = String(body.date_of_birth || "").trim()
    const residentialAddress = String(body.residential_address || "").trim()
    const planSelection = String(body.plan_id || "").trim()
    const remarks = String(body.remarks || "").trim()

    if (!fullName || !email || !phone || !gender || !dateOfBirth || !residentialAddress || !planSelection) {
      return NextResponse.json(
        { error: "Full name, email, phone number, gender, date of birth, address and plan are required" },
        { status: 400 }
      )
    }

    const { first_name, last_name } = splitName(fullName)
    if (!first_name || !last_name) {
      return NextResponse.json({ error: "Please provide first and last name" }, { status: 400 })
    }

    const parsedDob = new Date(dateOfBirth)
    if (Number.isNaN(parsedDob.getTime())) {
      return NextResponse.json({ error: "Invalid date of birth" }, { status: 400 })
    }

    const selectedClientPlan = await prisma.clientPlan.findFirst({
      where: {
        id: planSelection,
        ...(ownerWhere as any),
      },
      include: { invoice: true },
    })

    let selectedPlanId: string | null = null
    let selectedPlanName = ""
    let selectedPlanType: string | null = null
    let registrationStatus = "PENDING"
    let source = `CLIENT_PORTAL_${session.user.id}_${registerFor}`

    if (selectedClientPlan) {
      if (!["INVOICED", "PAID"].includes(selectedClientPlan.status)) {
        return NextResponse.json(
          { error: "Selected client plan is not yet approved for registration" },
          { status: 400 }
        )
      }

      registrationStatus = selectedClientPlan.status === "PAID" ? "PENDING" : "PENDING_PAYMENT"
      selectedPlanName = selectedClientPlan.plan_name
      selectedPlanType = "CUSTOM_CLIENT_PLAN"
      source = `CLIENT_PORTAL_${session.user.id}_${registerFor}_PLAN_${selectedClientPlan.id}`
    } else {
      const selectedPlan = await prisma.plan.findUnique({ where: { id: planSelection } })
      if (!selectedPlan) {
        return NextResponse.json({ error: "Selected plan not found" }, { status: 404 })
      }

      selectedPlanId = selectedPlan.id
      selectedPlanName = selectedPlan.name
      selectedPlanType = selectedPlan.plan_type
    }

    const existing = await prisma.principalRegistration.findFirst({
      where: {
        email,
        status: { in: ["PENDING", "REVIEW", "PENDING_PAYMENT"] },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "A pending registration already exists for this email" },
        { status: 409 }
      )
    }

    const registration = await prisma.principalRegistration.create({
      data: {
        first_name,
        last_name,
        gender,
        date_of_birth: parsedDob,
        phone_number: phone,
        email,
        residential_address: residentialAddress,
        organization_id: ownership.organizationId,
        organization_name: ownership.organizationName,
        organization_code: ownership.organizationCode,
        plan_id: selectedPlanId,
        plan_name: selectedPlanName,
        plan_type: selectedPlanType,
        remarks: remarks || null,
        source,
        status: registrationStatus,
      },
    })

    return NextResponse.json(
      {
        data: registration,
        message:
          registrationStatus === "PENDING_PAYMENT"
            ? "Registration submitted. It will be queued for review after payment confirmation."
            : "Registration submitted successfully",
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Client registration submission error:", error)
    return NextResponse.json({ error: "Failed to submit registration" }, { status: 500 })
  }
}
