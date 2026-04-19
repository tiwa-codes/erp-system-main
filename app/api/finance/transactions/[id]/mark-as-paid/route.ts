import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has finance permissions
    const hasPermission = await checkPermission(session.user.role as any, "finance", "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const transactionId = params.id

    // Get the transaction first to check its current status
    const existingTransaction = await prisma.financialTransaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        status: true,
        amount: true,
        transaction_type: true,
        reference_id: true
      }
    })

    if (!existingTransaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    if (existingTransaction.status !== 'PENDING') {
      return NextResponse.json({ 
        error: "Transaction is not pending and cannot be marked as paid",
        details: `Current status: ${existingTransaction.status}`
      }, { status: 400 })
    }

    // Update the transaction status to PAID and set processed_at
    const updatedTransaction = await prisma.financialTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'PAID',
        processed_at: new Date() // Set the processing timestamp
      },
      include: {
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    })

    // Create audit log for the status change
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "TRANSACTION_MARKED_PAID",
        resource: "financial_transaction",
        resource_id: transactionId,
        old_values: {
          status: existingTransaction.status,
          amount: existingTransaction.amount,
          transaction_type: existingTransaction.transaction_type,
          reference_id: existingTransaction.reference_id
        },
        new_values: {
          status: 'PAID',
          processed_at: updatedTransaction.processed_at
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: "Transaction marked as paid successfully",
      transaction: {
        id: updatedTransaction.id,
        status: updatedTransaction.status,
        processed_at: updatedTransaction.processed_at,
        amount: updatedTransaction.amount,
        transaction_type: updatedTransaction.transaction_type
      }
    })

  } catch (error) {
    console.error("Error marking transaction as paid:", error)
    return NextResponse.json(
      { error: "Failed to mark transaction as paid" },
      { status: 500 }
    )
  }
}
