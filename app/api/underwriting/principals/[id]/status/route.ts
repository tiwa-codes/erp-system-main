import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import { AccountStatus } from '@prisma/client'
import { provisionEnrolleeUser } from '@/lib/enrollee-provisioning'

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

    // Get the current principal
    const currentPrincipal = await prisma.principalAccount.findUnique({
      where: { id: params.id },
      select: { 
        id: true, 
        first_name: true, 
        last_name: true, 
        enrollee_id: true, 
        status: true 
      }
    })

    if (!currentPrincipal) {
      return NextResponse.json({ error: 'Principal not found' }, { status: 404 })
    }

    // Update the principal status
    const updatedPrincipal = await prisma.principalAccount.update({
      where: { id: params.id },
      data: {
        status: status as AccountStatus,
        updated_at: new Date()
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        enrollee_id: true,
        status: true
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PRINCIPAL_STATUS_CHANGE',
        resource: 'principal',
        resource_id: params.id,
        old_values: {
          status: currentPrincipal.status,
          principal_name: `${currentPrincipal.first_name} ${currentPrincipal.last_name}`,
          enrollee_id: currentPrincipal.enrollee_id
        },
        new_values: {
          status: status,
          principal_name: `${currentPrincipal.first_name} ${currentPrincipal.last_name}`,
          enrollee_id: currentPrincipal.enrollee_id,
          reason: reason || null
        },
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        user_agent: request.headers.get('user-agent') || null
      }
    })

    // Provision User account when principal is activated for the first time
    if (status === 'ACTIVE') {
      await provisionEnrolleeUser(params.id).catch((err) =>
        console.error('[Status Route] Enrollee provisioning error:', err)
      )
    }

    return NextResponse.json({
      message: `Principal status changed to ${status.toLowerCase()} successfully`,
      principal: updatedPrincipal
    })

  } catch (error) {
    console.error('Error changing principal status:', error)
    return NextResponse.json(
      { error: 'Failed to change principal status' },
      { status: 500 }
    )
  }
}
