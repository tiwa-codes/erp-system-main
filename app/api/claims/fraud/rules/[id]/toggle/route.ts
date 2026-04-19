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

    const canDetectFraud = await checkPermission(session.user.role as any, 'claims', 'fraud_detection')
    if (!canDetectFraud) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { is_active } = body

    if (typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'is_active must be a boolean' }, { status: 400 })
    }

    const updatedRule = await prisma.fraudRule.update({
      where: { id: params.id },
      data: { is_active },
      include: {
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'FRAUD_RULE_TOGGLE',
        resource: 'fraud_rule',
        resource_id: params.id,
        old_values: { is_active: !is_active },
        new_values: { is_active },
      },
    })

    return NextResponse.json(updatedRule)
  } catch (error) {
    console.error('Error toggling fraud rule:', error)
    return NextResponse.json(
      { error: 'Failed to toggle fraud rule' },
      { status: 500 }
    )
  }
}
