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
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canAccess = await checkPermission(session.user.role as any, 'finance', 'edit') || 
                      await checkPermission(session.user.role as any, 'hr', 'edit')
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const invoiceId = params.id

    // Update invoice status to paid
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paid_at: new Date()
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'INVOICE_PAID',
        resource: 'Invoice',
        resource_id: invoiceId,
        new_values: { status: 'PAID', paid_at: new Date() },
        created_at: new Date()
      }
    })

    return NextResponse.json({ invoice })
  } catch (error) {
    console.error('Error marking invoice as paid:', error)
    return NextResponse.json(
      { error: 'Failed to mark invoice as paid' },
      { status: 500 }
    )
  }
}
