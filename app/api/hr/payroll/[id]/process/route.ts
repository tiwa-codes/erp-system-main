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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const canEdit = await checkPermission(session.user.role as any, 'hr', 'edit')
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    // Check if payroll record exists
    const payrollRecord = await prisma.payroll.findUnique({
      where: { id },
      include: {
        employee: true
      }
    })

    if (!payrollRecord) {
      return NextResponse.json({ error: 'Payroll record not found' }, { status: 404 })
    }

    if (payrollRecord.status !== 'PENDING') {
      return NextResponse.json({ 
        error: 'Payroll record already processed',
        message: 'This payroll record has already been processed'
      }, { status: 400 })
    }

    const updatedPayroll = await prisma.payroll.update({
      where: { id },
      data: {
        status: 'PROCESSED',
        processed_by: session.user.id,
        processed_at: new Date()
      }
    })

    // Log the payroll update
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PROCESS',
        resource: 'payroll',
        resource_id: id,
        old_values: {
          status: payrollRecord.status
        },
        new_values: {
          status: 'PROCESSED',
          processed_by: session.user.id,
          processed_at: new Date()
        },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedPayroll,
      message: 'Payroll record processed successfully'
    })

  } catch (error) {
    console.error('Error processing payroll record:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to process payroll record',
      message: 'An error occurred while processing the payroll record'
    }, { status: 500 })
  }
}
