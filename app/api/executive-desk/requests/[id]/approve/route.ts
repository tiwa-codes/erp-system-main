import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { createJournalEntryFromTransaction } from "@/lib/finance/gl-utils"
import { getDefaultAccounts } from "@/lib/finance/account-helpers"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canApprove = await checkPermission(session.user.role as any, 'executive-desk', 'edit')
    if (!canApprove) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params
    const body = await request.json().catch(() => ({}))
    const comment = typeof body?.comment === "string" ? body.comment.trim() : ""

    // Find the procurement request
    const procurementRequest = await prisma.procurementInvoice.findUnique({
      where: { id },
      include: {
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true
          }
        }
      }
    })

    if (!procurementRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (procurementRequest.status !== 'PENDING_MD') {
      return NextResponse.json({ 
        error: 'Request has already been processed' 
      }, { status: 400 })
    }

    // Update status to PENDING_FINANCE
    const updatedRequest = await prisma.procurementInvoice.update({
      where: { id },
      data: {
        status: 'PENDING_FINANCE',
        executive_comment: comment || null,
        executive_by_id: session.user.id,
        executive_at: new Date(),
        updated_at: new Date()
      }
    })

    // Post to General Ledger when approved (before payment)
    // Debit: Asset/Expense Account (based on item type), Credit: Accounts Payable
    try {
      const accounts = await getDefaultAccounts()
      if (accounts.accountsPayableAccountId) {
        // Determine expense/asset account based on service type
        // For now, use a default expense account or office equipment
        // In a full implementation, this would be based on procurement item type
        const expenseAccountId = await prisma.chartOfAccount.findFirst({
          where: {
            OR: [
              { account_code: 5004 }, // Office Supplies Expense
              { account_name: { contains: "Office Supplies", mode: "insensitive" } },
              { account_name: { contains: "Expense", mode: "insensitive" } },
            ],
            is_active: true,
          },
        })

        if (expenseAccountId && accounts.accountsPayableAccountId) {
          await createJournalEntryFromTransaction({
            entry_date: new Date(),
            description: `Procurement approved: ${procurementRequest.invoice_number || procurementRequest.id}`,
            debit_account_id: expenseAccountId.id,
            credit_account_id: accounts.accountsPayableAccountId,
            amount: Number(procurementRequest.amount),
            reference_number: procurementRequest.invoice_number || `PROC-${id.slice(-8).toUpperCase()}`,
            reference_type: 'PROCUREMENT_INVOICE',
            reference_id: id,
            module: 'procurement',
            created_by_id: session.user.id,
          })
        }
      }
    } catch (glError) {
      console.error("Error posting to GL on approval:", glError)
      // Don't fail the approval if GL posting fails
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PROCUREMENT_MD_APPROVED',
        resource: 'procurement_invoice',
        resource_id: id,
        old_values: procurementRequest,
        new_values: updatedRequest
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Request approved and forwarded to finance',
      request: {
        id: updatedRequest.id,
        status: updatedRequest.status,
        service_type: updatedRequest.service_type,
        department: updatedRequest.department,
        amount: updatedRequest.amount
      }
    })
  } catch (error) {
    console.error('Error approving executive desk request:', error)
    return NextResponse.json(
      { error: 'Failed to approve request' },
      { status: 500 }
    )
  }
}
