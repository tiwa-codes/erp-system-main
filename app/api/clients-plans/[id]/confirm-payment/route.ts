import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { checkPermission } from "@/lib/permissions"

/**
 * PATCH /api/clients-plans/:id/confirm-payment
 * Admin: confirm payment evidence and unlock linked registrations
 */
export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canEdit = await checkPermission(session.user.role as any, "settings", "edit")
    if (!canEdit) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const clientPlan = await prisma.clientPlan.findUnique({
      where: { id: params.id },
      include: {
        invoice: true,
      },
    })

    if (!clientPlan) {
      return NextResponse.json({ error: "Client plan not found" }, { status: 404 })
    }

    if (clientPlan.status !== "INVOICED") {
      return NextResponse.json(
        { error: "Only invoiced plans can be confirmed as paid" },
        { status: 400 }
      )
    }

    if (!clientPlan.invoice) {
      return NextResponse.json({ error: "Invoice not found for this plan" }, { status: 404 })
    }

    const existingInvoiceData =
      clientPlan.invoice.invoice_data && typeof clientPlan.invoice.invoice_data === "object"
        ? (clientPlan.invoice.invoice_data as Record<string, unknown>)
        : {}

    const paymentEvidence = existingInvoiceData.payment_evidence as Record<string, unknown> | undefined

    if (!paymentEvidence?.url) {
      return NextResponse.json(
        { error: "Client has not uploaded payment evidence yet" },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.clientPlanInvoice.update({
        where: { id: clientPlan.invoice!.id },
        data: {
          status: "PAID",
          paid_at: new Date(),
          invoice_data: {
            ...existingInvoiceData,
            payment_confirmation: {
              confirmed_at: new Date().toISOString(),
              confirmed_by_id: session.user.id,
            },
          },
        },
      })

      await tx.clientPlan.update({
        where: { id: clientPlan.id },
        data: {
          status: "PAID",
          notification_read: false,
        },
      })

      await tx.principalRegistration.updateMany({
        where: {
          source: { contains: `PLAN_${clientPlan.id}` },
          status: "PENDING_PAYMENT",
        },
        data: {
          status: "PENDING",
        },
      })
    })

    return NextResponse.json(
      {
        message: "Payment confirmed successfully",
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error confirming client plan payment:", error)
    return NextResponse.json(
      { error: "Failed to confirm payment" },
      { status: 500 }
    )
  }
}
