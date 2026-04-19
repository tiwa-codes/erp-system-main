import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import { AccountStatus } from '@prisma/client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canEdit = await checkPermission(session.user.role as any, 'underwriting', 'edit')
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { status, reason } = await request.json()

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }

    // Validate status
    const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Get the current dependent
    const currentDependent = await prisma.dependent.findUnique({
      where: { id: params.id },
      select: { 
        id: true, 
        first_name: true, 
        last_name: true, 
        dependent_id: true, 
        status: true 
      }
    })

    if (!currentDependent) {
      return NextResponse.json({ error: 'Dependent not found' }, { status: 404 })
    }

    // Update the dependent status
    const updatedDependent = await prisma.dependent.update({
      where: { id: params.id },
      data: {
        status: status as AccountStatus,
        updated_at: new Date()
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        dependent_id: true,
        status: true
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'DEPENDENT_STATUS_CHANGE',
        resource: 'dependent',
        resource_id: params.id,
        old_values: {
          status: currentDependent.status,
          dependent_name: `${currentDependent.first_name} ${currentDependent.last_name}`,
          dependent_id: currentDependent.dependent_id
        },
        new_values: {
          status: status,
          dependent_name: `${currentDependent.first_name} ${currentDependent.last_name}`,
          dependent_id: currentDependent.dependent_id,
          reason: reason || null
        },
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        user_agent: request.headers.get('user-agent') || null
      }
    })

    return NextResponse.json({
      message: `Dependent status changed to ${status.toLowerCase()} successfully`,
      dependent: updatedDependent
    })

  } catch (error) {
    console.error('Error changing dependent status:', error)
    return NextResponse.json(
      { error: 'Failed to change dependent status' },
      { status: 500 }
    )
  }
}
