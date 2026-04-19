import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(
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

    const rule = await prisma.fraudRule.findUnique({
      where: { id: params.id },
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

    if (!rule) {
      return NextResponse.json({ error: 'Fraud rule not found' }, { status: 404 })
    }

    return NextResponse.json(rule)
  } catch (error) {
    console.error('Error fetching fraud rule:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fraud rule' },
      { status: 500 }
    )
  }
}

export async function PUT(
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
    const {
      name,
      category,
      description,
      severity,
      conditions,
      auto_action,
      risk_score_weight
    } = body

    if (!name || !category) {
      return NextResponse.json({ error: 'Name and category are required' }, { status: 400 })
    }

    const updatedRule = await prisma.fraudRule.update({
      where: { id: params.id },
      data: {
        name,
        category,
        description: description || '',
        severity: severity || 'MEDIUM',
        conditions: conditions || [],
        auto_action: auto_action || '',
        risk_score_weight: risk_score_weight || 50
      },
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
        action: 'FRAUD_RULE_UPDATE',
        resource: 'fraud_rule',
        resource_id: params.id,
        new_values: updatedRule,
      },
    })

    return NextResponse.json(updatedRule)
  } catch (error) {
    console.error('Error updating fraud rule:', error)
    return NextResponse.json(
      { error: 'Failed to update fraud rule' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Get the rule before deleting for audit trail
    const rule = await prisma.fraudRule.findUnique({
      where: { id: params.id }
    })

    if (!rule) {
      return NextResponse.json({ error: 'Fraud rule not found' }, { status: 404 })
    }

    await prisma.fraudRule.delete({
      where: { id: params.id }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'FRAUD_RULE_DELETE',
        resource: 'fraud_rule',
        resource_id: params.id,
        old_values: rule,
      },
    })

    return NextResponse.json({ message: 'Fraud rule deleted successfully' })
  } catch (error) {
    console.error('Error deleting fraud rule:', error)
    return NextResponse.json(
      { error: 'Failed to delete fraud rule' },
      { status: 500 }
    )
  }
}
