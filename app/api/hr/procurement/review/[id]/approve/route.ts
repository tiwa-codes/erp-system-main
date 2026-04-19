import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const approveSchema = z.object({
  stage: z.enum(['INTERNAL_CONTROL', 'AUDIT', 'MD', 'FINANCE'])
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
    const { stage } = approveSchema.parse(body)

    // Get current invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id }
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Determine next stage
    const stages = ['INTERNAL_CONTROL', 'AUDIT', 'MD', 'FINANCE']
    const currentIndex = stages.indexOf(stage)
    const nextStage = currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null

    // Update invoice
    const updatedInvoice = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        workflow_stage: nextStage,
        status: nextStage ? `PENDING_${nextStage}` : 'APPROVED',
        updated_at: new Date()
      }
    })

    // Log the approval
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "APPROVE",
        resource: "Invoice",
        resource_id: params.id,
        old_values: {
          workflow_stage: invoice.workflow_stage,
          status: invoice.status
        },
        new_values: {
          workflow_stage: nextStage,
          status: nextStage ? `PENDING_${nextStage}` : 'APPROVED'
        },
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        user_agent: request.headers.get("user-agent") || "unknown",
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedInvoice,
      message: `Invoice approved for ${stage} stage`
    })

  } catch (error) {
    console.error("Error approving invoice:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to approve invoice" },
      { status: 500 }
    )
  }
}
