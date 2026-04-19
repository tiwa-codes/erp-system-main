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

    const canAccess = await checkPermission(session.user.role as any, 'claims', 'fraud_detection')
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const claimId = params.id

    // Update claim status to approved
    await prisma.claim.update({
      where: { id: claimId },
      data: {
        status: 'APPROVED',
        approved_at: new Date(),
        processed_at: new Date()
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'CLAIM_APPROVED',
        resource: 'Claim',
        resource_id: claimId,
        new_values: { status: 'APPROVED' },
        created_at: new Date()
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error approving claim:', error)
    return NextResponse.json(
      { error: 'Failed to approve claim' },
      { status: 500 }
    )
  }
}
