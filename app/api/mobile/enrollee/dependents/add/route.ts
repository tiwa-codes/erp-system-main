/**
 * POST /api/mobile/enrollee/dependents/add
 * Enrollees can request to add a dependent.
 * This creates a DependentRegistration record linked to the principal's account.
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
    const { 
      first_name, 
      last_name, 
      middle_name, 
      date_of_birth, 
      gender, 
      relationship, 
      profile_picture,
      phone_number,
      email,
      residential_address
    } = body

    if (!first_name || !last_name || !date_of_birth || !relationship || !profile_picture) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // 1. Verify principal exists
    let principal_account_id: string | null = null

    const principal = await prisma.principalAccount.findUnique({
      where: { id: session.id },
      select: { id: true }
    })

    if (principal) {
      principal_account_id = principal.id
    } else {
      // Check if it's a dependent logged in
      const dep = await prisma.dependent.findUnique({
        where: { id: session.id },
        select: { principal_id: true }
      })
      if (dep) {
        principal_account_id = dep.principal_id
      }
    }

    if (!principal_account_id) {
      return NextResponse.json({ error: "Principal account not found" }, { status: 404 })
    }

    // 2. Create DependentRegistration
    const registration = await prisma.dependentRegistration.create({
      data: {
        principal_id: principal_account_id,
        first_name,
        last_name,
        middle_name: middle_name || null,
        date_of_birth: new Date(date_of_birth),
        gender: gender || null,
        relationship,
        profile_picture,
        phone_number: phone_number || null,
        email: email || null,
        residential_address: residential_address || null,
        status: "PENDING",
        source: "MOBILE_APP",
      },
    })

    return NextResponse.json({
      message: "Dependent registration submitted for review",
      registration_id: registration.id,
    })

  } catch (error) {
    console.error("[MOBILE_ADD_DEPENDENT]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
