import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildClientPlanOwnerWhere, getClientOwnership } from "@/lib/client-account"

function requireClientRole(role?: string) {
  return role?.toUpperCase() === "GUEST_OR_CLIENT"
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    if (!ownerWhere) {
      return NextResponse.json({ error: "Client account profile not found" }, { status: 404 })
    }

    const body = await request.json()
    const evidenceUrl = String(body.evidence_url || "").trim()
    const evidenceName = String(body.evidence_name || "").trim()
    const evidenceSize = Number(body.evidence_size || 0)

    if (!evidenceUrl || !evidenceName) {
      return NextResponse.json(
        { error: "Payment evidence URL and file name are required" },
        { status: 400 }
      )
    }

    const clientPlan = await prisma.clientPlan.findFirst({
      where: {
        id: params.id,
        ...(ownerWhere as any),
      },
      include: { invoice: true },
    })

    if (!clientPlan) {
      return NextResponse.json({ error: "Plan request not found" }, { status: 404 })
    }

    if (clientPlan.status !== "INVOICED") {
      return NextResponse.json(
        { error: "Payment evidence can only be uploaded for plans awaiting payment" },
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

    const updatedInvoice = await prisma.clientPlanInvoice.update({
      where: { id: clientPlan.invoice.id },
      data: {
        invoice_data: {
          ...existingInvoiceData,
          payment_evidence: {
            url: evidenceUrl,
            file_name: evidenceName,
            file_size: Number.isFinite(evidenceSize) ? evidenceSize : 0,
            submitted_at: new Date().toISOString(),
            submitted_by_id: session.user.id,
          },
        },
      },
    })

    const updatedPlan = await prisma.clientPlan.update({
      where: { id: clientPlan.id },
      data: { notification_read: false },
      include: {
        services: true,
        invoice: true,
      },
    })

    return NextResponse.json(
      {
        data: {
          plan: updatedPlan,
          invoice: updatedInvoice,
        },
        message: "Payment evidence uploaded successfully",
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Client payment evidence upload error:", error)
    return NextResponse.json({ error: "Failed to upload payment evidence" }, { status: 500 })
  }
}
