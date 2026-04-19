import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { calculateNextRunTime } from '@/lib/backup/scheduler'
import { z } from 'zod'
import { BackupType, ScheduleFrequency } from '@prisma/client'

const scheduleSchema = z.object({
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format'),
  backup_type: z.enum(['FULL', 'SCHEMA_ONLY', 'DATA_ONLY']),
  retention_days: z.number().int().min(1).max(365).default(30),
  is_active: z.boolean().optional().default(true),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = await checkPermission(session.user.role as any, 'settings', 'view')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const schedules = await prisma.backupSchedule.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: schedules,
    })
  } catch (error) {
    console.error('Error fetching schedules:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch schedules' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = await checkPermission(session.user.role as any, 'settings', 'edit')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validated = scheduleSchema.parse(body)

    const nextRun = calculateNextRunTime(
      validated.frequency as ScheduleFrequency,
      validated.time
    )

    const schedule = await prisma.backupSchedule.create({
      data: {
        frequency: validated.frequency as ScheduleFrequency,
        time: validated.time,
        backup_type: validated.backup_type as BackupType,
        retention_days: validated.retention_days,
        is_active: validated.is_active ?? true,
        next_run_at: nextRun,
        created_by_id: session.user.id,
      },
      include: {
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: schedule,
      message: 'Backup schedule created successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating schedule:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create schedule' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = await checkPermission(session.user.role as any, 'settings', 'edit')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 })
    }

    const validated = scheduleSchema.partial().parse(updateData)

    // Recalculate next_run_at if frequency or time changed
    let nextRun = undefined
    if (validated.frequency && validated.time) {
      const existing = await prisma.backupSchedule.findUnique({ where: { id } })
      if (existing) {
        nextRun = calculateNextRunTime(
          validated.frequency as ScheduleFrequency,
          validated.time
        )
      }
    }

    const schedule = await prisma.backupSchedule.update({
      where: { id },
      data: {
        ...validated,
        ...(nextRun && { next_run_at: nextRun }),
      },
      include: {
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: schedule,
      message: 'Backup schedule updated successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating schedule:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update schedule' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = await checkPermission(session.user.role as any, 'settings', 'edit')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 })
    }

    await prisma.backupSchedule.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Backup schedule deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting schedule:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete schedule' },
      { status: 500 }
    )
  }
}

