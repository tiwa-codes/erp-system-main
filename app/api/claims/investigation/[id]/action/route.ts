import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canDetectFraud = await checkPermission(session.user.role as any, 'claims', 'fraud_detection')
    if (!canDetectFraud) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { action, comment } = body

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    // Update claim status based on action
    let newStatus: string
    let updateData: any = {}

    switch (action) {
      case 'approve':
        newStatus = 'APPROVED'
        updateData.approved_at = new Date()
        break
      case 'investigate':
        newStatus = 'UNDER_REVIEW'
        break
      case 'reject':
        newStatus = 'REJECTED'
        updateData.rejected_at = new Date()
        updateData.rejection_reason = comment || 'Rejected during investigation'
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    updateData.status = newStatus
    updateData.processed_at = new Date()

    const updatedClaim = await prisma.claim.update({
      where: { id: params.id },
      data: updateData,
    })

    // Create investigation record
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'INVESTIGATION_ACTION',
        resource: 'claim',
        resource_id: params.id,
        new_values: {
          action,
          comment,
          status: newStatus,
          investigated_at: new Date()
        },
      },
    })

    return NextResponse.json({
      message: 'Investigation action submitted successfully',
      claim: updatedClaim
    })
  } catch (error) {
    console.error('Error submitting investigation action:', error)
    return NextResponse.json(
      { error: 'Failed to submit investigation action' },
      { status: 500 }
    )
  }
}
