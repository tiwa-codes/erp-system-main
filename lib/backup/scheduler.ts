import { prisma } from '@/lib/prisma'
import { createBackup } from './backup'
import { BackupType, BackupStatus, ScheduleFrequency } from '@prisma/client'
import { createAuditLog } from '@/lib/audit'

/**
 * Calculate next run time based on frequency
 */
export function calculateNextRunTime(frequency: ScheduleFrequency, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number)
  const now = new Date()
  const nextRun = new Date()

  nextRun.setHours(hours, minutes, 0, 0)

  switch (frequency) {
    case 'DAILY':
      // If time has passed today, schedule for tomorrow
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1)
      }
      break

    case 'WEEKLY':
      // Schedule for next week
      nextRun.setDate(nextRun.getDate() + 7)
      break

    case 'MONTHLY':
      // Schedule for next month
      nextRun.setMonth(nextRun.getMonth() + 1)
      break
  }

  return nextRun
}

/**
 * Execute scheduled backup
 */
export async function executeScheduledBackup(scheduleId: string): Promise<void> {
  const schedule = await prisma.backupSchedule.findUnique({
    where: { id: scheduleId },
    include: { created_by: true },
  })

  if (!schedule || !schedule.is_active) {
    return
  }

  // Check if it's time to run
  const now = new Date()
  if (schedule.next_run_at && now < schedule.next_run_at) {
    return
  }

  try {
    // Create backup
    const backup = await createBackup({
      backupName: `Scheduled ${schedule.frequency} backup`,
      backupType: schedule.backup_type as BackupType,
      createdById: schedule.created_by_id,
      uploadToCloud: true,
    })

    // Update schedule
    const nextRun = calculateNextRunTime(schedule.frequency, schedule.time)
    await prisma.backupSchedule.update({
      where: { id: scheduleId },
      data: {
        last_run_at: new Date(),
        next_run_at: nextRun,
      },
    })

    // Log success
    await createAuditLog({
      userId: schedule.created_by_id,
      action: 'SCHEDULED_BACKUP_COMPLETED',
      resource: 'backup_schedule',
      resourceId: scheduleId,
      newValues: {
        backup_id: backup.id,
        frequency: schedule.frequency,
      },
    })

    // Clean up old backups based on retention
    await cleanupOldBackups(schedule.retention_days)
  } catch (error) {
    // Log failure
    await createAuditLog({
      userId: schedule.created_by_id,
      action: 'SCHEDULED_BACKUP_FAILED',
      resource: 'backup_schedule',
      resourceId: scheduleId,
      newValues: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    })
  }
}

/**
 * Clean up old backups based on retention days
 */
async function cleanupOldBackups(retentionDays: number): Promise<void> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

  const oldBackups = await prisma.databaseBackup.findMany({
    where: {
      status: BackupStatus.COMPLETED,
      created_at: {
        lt: cutoffDate,
      },
      expires_at: {
        lte: new Date(),
      },
    },
  })

  for (const backup of oldBackups) {
    try {
      // Delete backup file and record
      const { deleteBackup } = await import('./backup')
      await deleteBackup(backup.id)
    } catch (error) {
      console.error(`Failed to delete old backup ${backup.id}:`, error)
    }
  }
}

/**
 * Check and execute all due scheduled backups
 */
export async function checkAndExecuteScheduledBackups(): Promise<void> {
  const now = new Date()
  
  const dueSchedules = await prisma.backupSchedule.findMany({
    where: {
      is_active: true,
      OR: [
        { next_run_at: { lte: now } },
        { next_run_at: null },
      ],
    },
  })

  for (const schedule of dueSchedules) {
    await executeScheduledBackup(schedule.id)
  }
}

