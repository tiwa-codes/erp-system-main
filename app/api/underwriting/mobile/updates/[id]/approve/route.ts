/**
 * POST /api/underwriting/mobile/updates/[id]/approve
 * Approves a mobile update (like PLAN_SWITCH).
 * Updates the enrollee profile and generates an invoice if applicable.
 */
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

interface RouteParams {
  params: {
    id: string
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canApprove = await checkPermission(session.user.role as any, "underwriting", "edit")
    if (!canApprove) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // 1. Fetch the MobileUpdate record
    const update = await prisma.mobileUpdate.findUnique({
      where: { id: params.id },
    })

    if (!update) {
      return NextResponse.json({ error: "Update request not found" }, { status: 404 })
    }

    if (update.status !== "PENDING") {
      return NextResponse.json({ error: "Only PENDING requests can be approved" }, { status: 400 })
    }

    const payload = update.payload as any

    // 2. Handle based on update type
    if (payload?.type === "PLAN_SWITCH") {
      const { new_plan_id } = payload

      // Verify the enrollee and plan
      const [principal, plan] = await Promise.all([
        prisma.principalAccount.findUnique({
          where: { id: update.target_id! },
          select: { id: true, first_name: true, last_name: true, enrollee_id: true }
        }),
        prisma.plan.findUnique({
          where: { id: new_plan_id },
          select: { id: true, name: true, plan_type: true, premium_amount: true }
        })
      ])

      if (!principal || !plan) {
        return NextResponse.json({ error: "Principal or Plan not found" }, { status: 404 })
      }

      // Generate invoice number
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`

      // Transaction: Update Plan + Create Invoice + Update status
      await prisma.$transaction([
        prisma.principalAccount.update({
          where: { id: principal.id },
          data: { plan_id: plan.id }
        }),
        prisma.invoice.create({
          data: {
            invoice_number: invoiceNumber,
            enrollee_id: principal.enrollee_id,
            enrollee_name: `${principal.first_name} ${principal.last_name}`,
            plan_id: plan.id,
            plan_type: plan.plan_type,
            plan_amount: plan.premium_amount,
            status: "PENDING",
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days later
          }
        }),
        prisma.mobileUpdate.update({
          where: { id: update.id },
          data: {
            status: "APPROVED",
            created_by_id: session.user.id
          }
        })
      ])

      return NextResponse.json({
        message: "Plan switch approved and invoice generated",
        invoice_number: invoiceNumber
      })
    }

    if (payload?.type === "HCP_CHANGE") {
      const { new_hospital_id, new_hospital_name, new_hospital_address } = payload

      // If we only have IDs, we might want to fetch details, 
      // but payload usually carries the name/address for snapshotting
      
      await prisma.$transaction([
        prisma.principalAccount.update({
          where: { id: update.target_id! },
          data: { 
            primary_hospital: new_hospital_name,
            hospital_address: new_hospital_address
          }
        }),
        prisma.mobileUpdate.update({
          where: { id: update.id },
          data: {
            status: "APPROVED",
            created_by_id: session.user.id
          }
        })
      ])

      return NextResponse.json({ message: "Hospital change approved" })
    }

    // Default for other types if any (generic approval)
    await prisma.mobileUpdate.update({
      where: { id: update.id },
      data: {
        status: "APPROVED",
        created_by_id: session.user.id
      }
    })

    return NextResponse.json({ message: "Update approved" })

  } catch (error) {
    console.error("[MOBILE_UPDATE_APPROVAL]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
