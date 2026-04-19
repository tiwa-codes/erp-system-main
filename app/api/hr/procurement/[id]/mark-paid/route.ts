import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to update procurement
    const canUpdate = await checkPermission(session.user.role as any, 'hr', 'procurement')
    if (!canUpdate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    // Find the procurement invoice
    const invoice = await prisma.procurementInvoice.findUnique({
      where: { id }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    console.log('Invoice status:', invoice.status)
    
    if (invoice.status === 'PAID') {
      return NextResponse.json({ 
        error: 'Invoice is already paid',
        currentStatus: invoice.status 
      }, { status: 400 })
    }

    // Update invoice status to paid
    const updatedInvoice = await prisma.procurementInvoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paid_at: new Date(),
        updated_at: new Date()
      }
    })

    // Update related financial transaction
    await prisma.financialTransaction.updateMany({
      where: {
        reference_id: invoice.invoice_number,
        reference_type: 'PROCUREMENT_INVOICE'
      },
      data: {
        status: 'PROCESSED',
        processed_at: new Date()
      }
    })

    // Log the payment
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PROCUREMENT_INVOICE_PAID',
        resource: 'procurement_invoice',
        resource_id: id,
        old_values: { status: invoice.status },
        new_values: { status: 'PAID', paid_at: new Date() }
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedInvoice,
      message: 'Invoice marked as paid successfully'
    })
  } catch (error) {
    console.error('Error marking invoice as paid:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    })
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to mark invoice as paid',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
