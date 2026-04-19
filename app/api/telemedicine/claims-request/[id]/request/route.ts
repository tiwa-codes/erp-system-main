import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

export async function POST(
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

    // Check if claim exists
    const existingClaim = await prisma.claim.findUnique({
      where: { id },
      select: { id: true, status: true, claim_type: true }
    })

    if (!existingClaim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    // Only allow requesting NEW claims
    if (existingClaim.status !== 'NEW') {
      return NextResponse.json({ 
        error: `Claim has already been ${existingClaim.status.toLowerCase()}. Cannot request again.` 
      }, { status: 400 })
    }

    // Update the claim status to PENDING (sent to vetter1)
    const updatedClaim = await prisma.claim.update({
      where: { id },
      data: {
        status: 'PENDING',
        updated_at: new Date()
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
      message: 'Claim has been sent to vetter1 for processing'
    })

  } catch (error) {
    console.error('Error requesting claim:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
