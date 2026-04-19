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
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const canView = await checkPermission(session.user.role as any, 'hr', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const hrRule = await prisma.hRRule.findUnique({
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

    if (!hrRule) {
      return NextResponse.json({ error: 'HR Rule not found' }, { status: 404 })
    }

    return NextResponse.json({ hrRule })
  } catch (error) {
    console.error('Error fetching HR rule:', error)
    return NextResponse.json(
      { error: 'Failed to fetch HR rule' },
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
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const canEdit = await checkPermission(session.user.role as any, 'hr', 'edit')
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const {
      name,
      description,
      rule_type,
      conditions,
      actions,
      is_active,
      priority
    } = await request.json()

    // Get existing HR rule for audit trail
    const existingHRRule = await prisma.hRRule.findUnique({
      where: { id: params.id }
    })

    if (!existingHRRule) {
      return NextResponse.json({ error: 'HR Rule not found' }, { status: 404 })
    }

    // Validate required fields
    if (!name || !rule_type || !conditions || !actions) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        message: 'Name, rule type, conditions, and actions are required'
      }, { status: 400 })
    }

    // Validate JSON fields
    try {
      JSON.parse(JSON.stringify(conditions))
      JSON.parse(JSON.stringify(actions))
    } catch (error) {
      return NextResponse.json({ 
        error: 'Invalid JSON format',
        message: 'Conditions and actions must be valid JSON'
      }, { status: 400 })
    }

    const updatedHRRule = await prisma.hRRule.update({
      where: { id: params.id },
      data: {
        name,
        description: description || null,
        rule_type,
        conditions,
        actions,
        is_active: is_active !== undefined ? is_active : existingHRRule.is_active,
        priority: priority !== undefined ? priority : existingHRRule.priority
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
        action: 'UPDATE',
        resource: 'HRRule',
        resource_id: params.id,
        old_values: {
          name: existingHRRule.name,
          rule_type: existingHRRule.rule_type,
          is_active: existingHRRule.is_active,
          priority: existingHRRule.priority
        },
        new_values: {
          name: updatedHRRule.name,
          rule_type: updatedHRRule.rule_type,
          is_active: updatedHRRule.is_active,
          priority: updatedHRRule.priority
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'HR Rule updated successfully',
      hrRule: updatedHRRule
    })
  } catch (error) {
    console.error('Error updating HR rule:', error)
    return NextResponse.json(
      { error: 'Failed to update HR rule' },
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
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const canDelete = await checkPermission(session.user.role as any, 'hr', 'delete')
    if (!canDelete) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get existing HR rule for audit trail
    const existingHRRule = await prisma.hRRule.findUnique({
      where: { id: params.id }
    })

    if (!existingHRRule) {
      return NextResponse.json({ error: 'HR Rule not found' }, { status: 404 })
    }

    await prisma.hRRule.delete({
      where: { id: params.id }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'DELETE',
        resource: 'HRRule',
        resource_id: params.id,
        old_values: {
          name: existingHRRule.name,
          rule_type: existingHRRule.rule_type,
          is_active: existingHRRule.is_active,
          priority: existingHRRule.priority
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'HR Rule deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting HR rule:', error)
    return NextResponse.json(
      { error: 'Failed to delete HR rule' },
      { status: 500 }
    )
  }
}
