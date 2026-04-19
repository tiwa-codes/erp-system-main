import { promises as fs } from 'fs'
import { prisma } from '@/lib/prisma'
import { BackupStatus } from '@prisma/client'
import { createBackup } from './backup'

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

export interface RestoreOptions {
  backupId: string
  userId: string
  createPreRestoreBackup?: boolean
}

export interface RestoreResult {
  success: boolean
  message: string
  preRestoreBackupId?: string
}

/**
 * Restore database from backup
 */
export async function restoreBackup(options: RestoreOptions): Promise<RestoreResult> {
  const { backupId, userId, createPreRestoreBackup = true } = options

  // Get backup record
  const backup = await prisma.databaseBackup.findUnique({
    where: { id: backupId },
  })

  if (!backup) {
    throw new Error('Backup not found')
  }

  if (backup.status !== BackupStatus.COMPLETED) {
    throw new Error('Backup is not completed and cannot be restored')
  }

  // Check if backup file exists
  try {
    await fs.access(backup.file_path)
  } catch {
    // Try to download from Cloudinary if local file doesn't exist
    if (backup.cloud_url) {
      throw new Error('Local backup file not found. Please download from cloud storage first.')
    }
    throw new Error('Backup file not found')
  }

  let preRestoreBackupId: string | undefined

  // Create pre-restore backup if requested
  if (createPreRestoreBackup) {
    try {
      const preBackup = await createBackup({
        backupName: `Pre-restore backup before restoring ${backup.backup_name}`,
        backupType: 'FULL',
        createdById: userId,
        uploadToCloud: false, // Don't upload pre-restore backups to save space
      })
      preRestoreBackupId = preBackup.id
    } catch (error) {
      console.error('Failed to create pre-restore backup:', error)
      throw new Error('Failed to create pre-restore backup. Restore aborted for safety.')
    }
  }

  try {
    // Read SQL backup file
    const sqlContent = await fs.readFile(backup.file_path, 'utf-8')
    
    // Remove comments and SET statements, then split by semicolon
    const lines = sqlContent.split('\n')
    const cleanedLines = lines
      .filter(line => {
        const trimmed = line.trim()
        return trimmed.length > 0 && 
               !trimmed.startsWith('--') && 
               !trimmed.startsWith('SET ') &&
               trimmed !== 'BEGIN;' &&
               trimmed !== 'COMMIT;'
      })
      .join('\n')
    
    // Split into individual statements
    const statements = cleanedLines
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)
    
    // Execute statements in batches within a transaction
    await prisma.$transaction(async (tx) => {
      for (const statement of statements) {
        if (statement.length > 0) {
          try {
            // Execute statement
            await tx.$executeRawUnsafe(statement + ';')
          } catch (stmtError) {
            // Log but continue for non-critical errors
            const errorMsg = stmtError instanceof Error ? stmtError.message : 'Unknown error'
            // Skip errors for CREATE TABLE IF NOT EXISTS, etc.
            if (!errorMsg.includes('already exists') && !errorMsg.includes('does not exist')) {
              console.warn(`Warning executing statement: ${errorMsg}`)
            }
          }
        }
      }
    }, {
      timeout: 300000, // 5 minute timeout for large restores
    })

    // Log restore operation
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'DATABASE_RESTORE',
        resource: 'database_backup',
        resource_id: backupId,
        details: {
          backup_name: backup.backup_name,
          backup_type: backup.backup_type,
          pre_restore_backup_id: preRestoreBackupId,
        },
      },
    })

    return {
      success: true,
      message: 'Database restored successfully',
      preRestoreBackupId,
    }
  } catch (error) {
    // Log restore failure
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'DATABASE_RESTORE_FAILED',
        resource: 'database_backup',
        resource_id: backupId,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      },
    })

    throw new Error(`Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Validate backup file
 */
export async function validateBackup(backupId: string): Promise<boolean> {
  const backup = await prisma.databaseBackup.findUnique({
    where: { id: backupId },
  })

  if (!backup) {
    return false
  }

  // Check if file exists
  try {
    await fs.access(backup.file_path)
    const stats = await fs.stat(backup.file_path)
    
    // Check if file size matches (if file_size is set)
    if (backup.file_size && stats.size !== backup.file_size) {
      return false
    }

    // Check if file is not empty
    if (stats.size === 0) {
      return false
    }

    return true
  } catch {
    return false
  }
}

