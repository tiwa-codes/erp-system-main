import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

const PROCUREMENT_MODULES = ['hr', 'claims', 'provider', 'underwriting', 'call-centre', 'finance', 'legal', 'telemedicine'] as const

async function hasProcurementAccess(role: string) {
  const checks = await Promise.all(
    PROCUREMENT_MODULES.map((module) => checkPermission(role as any, module, 'procurement'))
  )

  return checks.some(Boolean)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canAccess = await hasProcurementAccess(session.user.role as string)
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const invoice = await prisma.procurementInvoice.findUnique({
      where: { id: params.id }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const isElevated = ['SUPER_ADMIN', 'ADMIN', 'FINANCE_OFFICER'].includes(session.user.role as string)
    if (!isElevated && invoice.created_by_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (invoice.status !== 'REJECTED') {
      return NextResponse.json(
        { error: `Only rejected invoices can be edited and resent. Current status: ${invoice.status}` },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const service_type = typeof body?.service_type === 'string' ? body.service_type.trim() : ''
    const department = typeof body?.department === 'string' ? body.department.trim() : ''
    const amount = Number(body?.amount)
    const description = typeof body?.description === 'string' ? body.description.trim() : ''
    const resubmission_comment = typeof body?.resubmission_comment === 'string' ? body.resubmission_comment.trim() : ''

    if (!service_type || !department || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 })
    }

    const attachment = body?.attachment
    const attachment_url = typeof attachment?.url === 'string' ? attachment.url : null
    const attachment_name = typeof attachment?.name === 'string' ? attachment.name : null

    const updatedInvoice = await prisma.procurementInvoice.update({
      where: { id: params.id },
      data: {
        service_type,
        department,
        amount,
        description: description || null,
        attachment_url,
        attachment_name,
        status: 'PENDING',
        // Keep prior comments/history for traceability, but clear active rejection marker.
        rejection_reason: null,
        updated_at: new Date()
      }
    })

    await prisma.financialTransaction.updateMany({
      where: {
        reference_id: invoice.invoice_number,
        reference_type: 'PROCUREMENT_INVOICE'
      },
      data: {
        status: 'PENDING',
        processed_at: null
      }
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PROCUREMENT_INVOICE_RESUBMITTED',
        resource: 'procurement_invoice',
        resource_id: params.id,
        old_values: {
          status: invoice.status,
          amount: invoice.amount,
          service_type: invoice.service_type,
          department: invoice.department,
          description: invoice.description,
          attachment_url: invoice.attachment_url,
          attachment_name: invoice.attachment_name,
          rejection_reason: invoice.rejection_reason,
        },
        new_values: {
          status: updatedInvoice.status,
          amount: updatedInvoice.amount,
          service_type: updatedInvoice.service_type,
          department: updatedInvoice.department,
          description: updatedInvoice.description,
          attachment_url: updatedInvoice.attachment_url,
          attachment_name: updatedInvoice.attachment_name,
          resubmission_comment,
        },
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedInvoice,
      message: 'Invoice updated and resubmitted successfully'
    })
  } catch (error) {
    console.error('Error updating and resubmitting procurement invoice:', error)
    return NextResponse.json(
      { error: 'Failed to update and resubmit procurement invoice' },
      { status: 500 }
    )
  }
}
