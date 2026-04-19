import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const rejectSchema = z.object({
  reason: z.string().min(1, "Reason is required")
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { reason } = rejectSchema.parse(body)

    // Get current invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id }
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Update invoice
    const updatedInvoice = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        status: 'REJECTED',
        rejection_reason: reason,
        updated_at: new Date()
      }
    })

    // Log the rejection
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "REJECT",
        resource: "Invoice",
        resource_id: params.id,
        old_values: {
          workflow_stage: invoice.workflow_stage,
          status: invoice.status
        },
        new_values: {
          status: 'REJECTED',
          rejection_reason: reason
        },
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        user_agent: request.headers.get("user-agent") || "unknown",
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedInvoice,
      message: "Invoice rejected successfully"
    })

  } catch (error) {
    console.error("Error rejecting invoice:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to reject invoice" },
      { status: 500 }
    )
  }
}
