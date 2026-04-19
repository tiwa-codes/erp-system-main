import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true }
    })

    if (!user?.role) {
      return NextResponse.json({ error: 'User role not found' }, { status: 403 })
    }

    // Check permission - use role name string, not the role object
    const hasPermission = await checkPermission(user.role.name as any, 'telemedicine', 'edit')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }

    // Validate status
    const validStatuses = ['NEW', 'PENDING', 'APPROVED', 'REJECTED', 'PAID']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ 
        error: 'Invalid status. Must be one of: NEW, PENDING, APPROVED, REJECTED, PAID' 
      }, { status: 400 })
    }

    // Check if claim exists
    const existingClaim = await prisma.claim.findUnique({
      where: { id },
      select: { id: true, status: true, claim_type: true }
    })

    if (!existingClaim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    // Update the claim status
    const updatedClaim = await prisma.claim.update({
      where: { id },
      data: {
        status: status as any,
        updated_at: new Date(),
        // Set processed_at if moving to approved/rejected
        ...(status === 'APPROVED' && { processed_at: new Date() }),
        ...(status === 'REJECTED' && { processed_at: new Date() }),
        // Set approved_at if moving to approved
        ...(status === 'APPROVED' && { approved_at: new Date() }),
        // Set rejected_at if moving to rejected
        ...(status === 'REJECTED' && { rejected_at: new Date() })
      },
      include: {
        principal: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true,
            phone_number: true,
            email: true
          }
        },
        provider: {
          select: {
            id: true,
            facility_name: true,
            facility_type: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedClaim,
      message: `Claim status updated to ${status}`
    })

  } catch (error) {
    console.error('Error updating claim status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true }
    })

    if (!user?.role) {
      return NextResponse.json({ error: 'User role not found' }, { status: 403 })
    }

    // Check permission - use role name string, not the role object
    const hasPermission = await checkPermission(user.role.name as any, 'telemedicine', 'view')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    // Get the claim with all related data
    const claim = await prisma.claim.findUnique({
      where: { id },
      include: {
        principal: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true,
            phone_number: true,
            email: true
          }
        },
        provider: {
          select: {
            id: true,
            facility_name: true,
            facility_type: true
          }
        }
      }
    })

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: claim
    })

  } catch (error) {
    console.error('Error fetching claim:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
