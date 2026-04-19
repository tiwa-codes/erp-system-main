import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { BackupStatus } from '@prisma/client'

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

    // Get total backups
    const totalBackups = await prisma.databaseBackup.count({
      where: { status: { not: 'DELETED' } },
    })

    // Get completed backups
    const completedBackups = await prisma.databaseBackup.count({
      where: { status: BackupStatus.COMPLETED },
    })

    // Get total size
    const sizeResult = await prisma.databaseBackup.aggregate({
      where: { status: BackupStatus.COMPLETED },
      _sum: {
        file_size: true,
      },
    })

    const totalSize = sizeResult._sum.file_size || 0

    // Get last backup
    const lastBackup = await prisma.databaseBackup.findFirst({
      where: { status: BackupStatus.COMPLETED },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        backup_name: true,
        created_at: true,
        file_size: true,
      },
    })

    // Get active schedules
    const activeSchedules = await prisma.backupSchedule.count({
      where: { is_active: true },
    })

    // Get failed backups count
    const failedBackups = await prisma.databaseBackup.count({
      where: { status: BackupStatus.FAILED },
    })

    return NextResponse.json({
      success: true,
      data: {
        total_backups: totalBackups,
        completed_backups: completedBackups,
        failed_backups: failedBackups,
        total_size_bytes: totalSize,
        total_size_mb: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
        last_backup: lastBackup,
        active_schedules: activeSchedules,
      },
    })
  } catch (error) {
    console.error('Error fetching backup stats:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch backup statistics' },
      { status: 500 }
    )
  }
}

