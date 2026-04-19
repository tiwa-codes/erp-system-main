import { promises as fs } from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { uploadFile } from '@/lib/cloudinary'
import { BackupType, BackupStatus } from '@prisma/client'
import { createWriteStream } from 'fs'
import { Writable } from 'stream'

const BACKUP_STORAGE_PATH = process.env.BACKUP_STORAGE_PATH || './backups/database'
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

export interface BackupOptions {
  backupName?: string
  backupType: BackupType
  createdById: string
  uploadToCloud?: boolean
}

export interface BackupResult {
  id: string
  filePath: string
  fileSize: number
  cloudUrl?: string
  status: BackupStatus
}

/**
 * Create a database backup
 */
export async function createBackup(options: BackupOptions): Promise<BackupResult> {
  const { backupName, backupType, createdById, uploadToCloud = true } = options

  // Generate backup ID and filename
  const backupId = `backup-${Date.now()}-${Math.random().toString(36).substring(7)}`
  const dateFolder = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const backupDir = path.join(BACKUP_STORAGE_PATH, dateFolder)
  const backupFileName = `${backupId}.sql`
  const backupFilePath = path.join(backupDir, backupFileName)

  // Create backup record
  const backupRecord = await prisma.databaseBackup.create({
    data: {
      backup_name: backupName || `Backup ${new Date().toLocaleString()}`,
      backup_type: backupType,
      file_path: backupFilePath,
      status: BackupStatus.IN_PROGRESS,
      created_by_id: createdById,
    },
  })

  try {
    // Ensure backup directory exists
    await fs.mkdir(backupDir, { recursive: true })

    const writeStream = createWriteStream(backupFilePath)
    
    // Write SQL header
    const dbName = new URL(DATABASE_URL).pathname.replace('/', '') || 'database'
    const header = `-- Database Backup
-- Created: ${new Date().toISOString()}
-- Backup Type: ${backupType}
-- Database: ${dbName}

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

BEGIN;

`
    writeStream.write(header)

    if (backupType !== 'DATA_ONLY') {
      // Export schema using Prisma introspection
      writeStream.write('-- ============================================\n')
      writeStream.write('-- SCHEMA\n')
      writeStream.write('-- ============================================\n\n')
      await exportSchema(writeStream)
      writeStream.write('\n\n')
    }

    if (backupType !== 'SCHEMA_ONLY') {
      // Export data
      writeStream.write('-- ============================================\n')
      writeStream.write('-- DATA\n')
      writeStream.write('-- ============================================\n\n')
      await exportData(writeStream)
    }

    // Write footer
    writeStream.write('\nCOMMIT;\n')

    // Close stream and wait for it to finish
    await new Promise<void>((resolve, reject) => {
      writeStream.end()
      writeStream.on('finish', resolve)
      writeStream.on('error', reject)
    })

    // Get file size
    const stats = await fs.stat(backupFilePath)
    const fileSize = stats.size

    // Upload to Cloudinary if requested
    let cloudUrl: string | undefined
    if (uploadToCloud) {
      try {
        const fileBuffer = await fs.readFile(backupFilePath)
        // For raw files like SQL backups, we need to use a different approach
        // Cloudinary's upload_stream works better for large files
        const { v2: cloudinary } = await import('cloudinary')
        
        // Upload using upload_stream for better handling of large files
        const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'erp-backups/database',
              resource_type: 'raw',
              use_filename: true,
              unique_filename: true,
              overwrite: false,
            },
            (error, result) => {
              if (error) {
                console.error('Cloudinary upload error:', error)
                reject(error)
              } else if (result) {
                resolve({ secure_url: result.secure_url })
              } else {
                reject(new Error('Upload failed: No result returned'))
              }
            }
          )
          
          uploadStream.on('error', (error) => {
            console.error('Upload stream error:', error)
            reject(error)
          })
          
          uploadStream.end(fileBuffer)
        })
        
        cloudUrl = uploadResult.secure_url
        console.log('Backup uploaded to Cloudinary:', cloudUrl)
      } catch (uploadError) {
        console.error('Failed to upload backup to Cloudinary:', uploadError)
        // Continue even if cloud upload fails - backup is still saved locally
      }
    }

    // Update backup record
    const updatedBackup = await prisma.databaseBackup.update({
      where: { id: backupRecord.id },
      data: {
        status: BackupStatus.COMPLETED,
        file_size: fileSize,
        cloud_url: cloudUrl,
        completed_at: new Date(),
        metadata: {
          tables: await getTableCount(),
          backup_duration: Date.now() - new Date(backupRecord.created_at).getTime(),
        },
      },
    })

    return {
      id: updatedBackup.id,
      filePath: backupFilePath,
      fileSize,
      cloudUrl,
      status: BackupStatus.COMPLETED,
    }
  } catch (error) {
    // Update backup record with error
    await prisma.databaseBackup.update({
      where: { id: backupRecord.id },
      data: {
        status: BackupStatus.FAILED,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      },
    })

    throw error
  }
}

/**
 * Export database schema
 */
async function exportSchema(writeStream: NodeJS.WritableStream): Promise<void> {
  try {
    // Get all table creation statements using pg_dump equivalent queries
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `

    for (const table of tables) {
      // Skip backup-related tables to avoid recursion
      if (table.tablename === 'database_backups' || table.tablename === 'backup_schedules') {
        continue
      }

      // Get table definition using information_schema
      try {
        const tableDef = await prisma.$queryRawUnsafe(`
          SELECT 
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default,
            udt_name
          FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = '${table.tablename}'
          ORDER BY ordinal_position
        `) as Array<{
          column_name: string
          data_type: string
          character_maximum_length: number | null
          is_nullable: string
          column_default: string | null
          udt_name: string
        }>

        if (tableDef.length > 0) {
          writeStream.write(`-- Table: ${table.tablename}\n`)
          writeStream.write(`CREATE TABLE IF NOT EXISTS "${table.tablename}" (\n`)
          
          const columns: string[] = []
          for (const col of tableDef) {
            let colDef = `  "${col.column_name}" ${col.udt_name}`
            
            // Add length for varchar/char types
            if (col.character_maximum_length) {
              colDef = colDef.replace(col.udt_name, `${col.udt_name}(${col.character_maximum_length})`)
            }
            
            if (col.is_nullable === 'NO') {
              colDef += ' NOT NULL'
            }
            if (col.column_default) {
              colDef += ` DEFAULT ${col.column_default}`
            }
            columns.push(colDef)
          }
          
          writeStream.write(columns.join(',\n'))
          writeStream.write('\n);\n\n')
        }
      } catch (tableError) {
        console.error(`Error exporting table ${table.tablename}:`, tableError)
        writeStream.write(`-- Table: ${table.tablename} (schema export failed)\n\n`)
      }
    }
  } catch (error) {
    console.error('Error exporting schema:', error)
    writeStream.write('-- Schema export encountered errors\n')
  }
}

/**
 * Export database data
 */
async function exportData(writeStream: NodeJS.WritableStream): Promise<void> {
  try {
    // Get all tables
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      AND tablename != '_prisma_migrations'
      AND tablename != 'database_backups'
      AND tablename != 'backup_schedules'
      ORDER BY tablename
    `

    for (const table of tables) {
      try {
        // Get row count
        const countResult = await prisma.$queryRawUnsafe(`
          SELECT COUNT(*)::bigint as count FROM "${table.tablename}"
        `) as Array<{ count: bigint }>
        
        const rowCount = Number(countResult[0]?.count || 0)
        
        if (rowCount === 0) {
          writeStream.write(`-- Table: ${table.tablename} (empty)\n\n`)
          continue
        }

        writeStream.write(`-- Table: ${table.tablename} (${rowCount} rows)\n`)
        
        // Get column names
        const columns = await prisma.$queryRawUnsafe(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = '${table.tablename}'
          ORDER BY ordinal_position
        `) as Array<{ column_name: string }>
        
        const columnNames = columns.map(c => `"${c.column_name}"`).join(', ')

        // Export data in batches to avoid memory issues
        const batchSize = 500
        let offset = 0
        
        while (offset < rowCount) {
          // Use raw query to fetch data
          const rows = await prisma.$queryRawUnsafe(`
            SELECT * FROM "${table.tablename}" 
            LIMIT ${batchSize} OFFSET ${offset}
          `) as Array<Record<string, any>>

          for (const row of rows) {
            const values = columns.map(col => {
              const value = row[col.column_name]
              if (value === null || value === undefined) return 'NULL'
              if (typeof value === 'string') {
                // Escape single quotes and wrap in quotes
                return `'${value.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`
              }
              if (value instanceof Date) {
                return `'${value.toISOString()}'`
              }
              if (typeof value === 'boolean') {
                return value ? 'true' : 'false'
              }
              if (typeof value === 'object') {
                // Handle JSON/JSONB fields
                return `'${JSON.stringify(value).replace(/'/g, "''")}'`
              }
              return String(value)
            }).join(', ')

            writeStream.write(`INSERT INTO "${table.tablename}" (${columnNames}) VALUES (${values});\n`)
          }

          offset += batchSize
        }
        
        writeStream.write('\n')
      } catch (tableError) {
        console.error(`Error exporting table ${table.tablename}:`, tableError)
        writeStream.write(`-- Error exporting table ${table.tablename}: ${tableError instanceof Error ? tableError.message : 'Unknown error'}\n\n`)
      }
    }
  } catch (error) {
    console.error('Error exporting data:', error)
    writeStream.write(`-- Data export failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`)
  }
}

/**
 * Get table count from database
 */
async function getTableCount(): Promise<number> {
  try {
    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `
    return Number(result[0]?.count || 0)
  } catch {
    return 0
  }
}

/**
 * Delete backup file and record
 */
export async function deleteBackup(backupId: string): Promise<void> {
  const backup = await prisma.databaseBackup.findUnique({
    where: { id: backupId },
  })

  if (!backup) {
    throw new Error('Backup not found')
  }

  // Delete local file if exists
  try {
    await fs.unlink(backup.file_path)
  } catch (error) {
    // File might not exist, continue
    console.warn('Failed to delete local backup file:', error)
  }

  // Delete from Cloudinary if cloud_url exists
  if (backup.cloud_url) {
    try {
      // Extract public_id from Cloudinary URL
      const urlParts = backup.cloud_url.split('/')
      const publicId = urlParts[urlParts.length - 1].replace(/\.[^/.]+$/, '')
      const fullPublicId = `erp-backups/database/${publicId}`
      
      const { v2: cloudinary } = await import('cloudinary')
      await cloudinary.uploader.destroy(fullPublicId, { resource_type: 'raw' })
    } catch (error) {
      console.warn('Failed to delete backup from Cloudinary:', error)
      // Continue even if cloud delete fails
    }
  }

  // Update record status to DELETED
  await prisma.databaseBackup.update({
    where: { id: backupId },
    data: {
      status: BackupStatus.DELETED,
    },
  })
}

