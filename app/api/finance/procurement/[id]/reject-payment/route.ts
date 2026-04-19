import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { ProcurementStatus } from "@prisma/client"
import { z } from "zod"

const rejectPaymentSchema = z.object({
  rejection_reason: z.string().min(1, "Rejection reason is required"),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const hasPermission = await checkPermission(session.user.role as any, "finance", "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const invoiceId = params.id
    const body = await request.json()
    const validatedData = rejectPaymentSchema.parse(body)

    // Get the invoice
    const invoice = await prisma.procurementInvoice.findUnique({
      where: { id: invoiceId },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Allow rejection while awaiting finance action.
    if (invoice.status !== ProcurementStatus.APPROVED && invoice.status !== ProcurementStatus.PENDING_FINANCE) {
      return NextResponse.json(
        { error: `Cannot reject payment. Current status: ${invoice.status}` },
        { status: 400 }
      )
    }

    // Update invoice status to REJECTED
    const updatedInvoice = await prisma.procurementInvoice.update({
      where: { id: invoiceId },
      data: {
        status: ProcurementStatus.REJECTED,
        rejection_reason: validatedData.rejection_reason,
        executive_comment: validatedData.rejection_reason,
        executive_by_id: session.user.id,
        executive_at: new Date(),
        updated_at: new Date(),
      },
    })

    // Update related financial transaction if exists
    await prisma.financialTransaction.updateMany({
      where: {
        reference_id: invoice.invoice_number,
        reference_type: "PROCUREMENT_INVOICE",
      },
      data: {
        status: "FAILED",
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "PROCUREMENT_PAYMENT_REJECTED",
        resource: "procurement_invoice",
        resource_id: invoiceId,
        old_values: { status: invoice.status },
        new_values: {
          status: ProcurementStatus.REJECTED,
          rejection_reason: validatedData.rejection_reason,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: "Payment rejected successfully",
      data: updatedInvoice,
    })
  } catch (error) {
    console.error("Error rejecting payment:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors,
        },
        { status: 400 }
      )
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reject payment",
      },
      { status: 500 }
    )
  }
}



