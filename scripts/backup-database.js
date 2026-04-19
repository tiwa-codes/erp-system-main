#!/usr/bin/env node

/**
 * Database Backup Script
 * 
 * This script creates a complete backup of the current database
 * It exports all tables and data to JSON files for easy restoration
 * 
 * Usage: node scripts/backup-database.js
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config()

const prisma = new PrismaClient()

// Define table order to respect foreign key constraints
const TABLE_ORDER = [
  // Core tables first (no dependencies)
  'User',
  'Role',
  'Organization',
  'Plan',
  'ServiceType',
  'PlanBand',
  'CoveredService',
  'FacilityTariff',
  
  // Dependent tables
  'PrincipalAccount',
  'Dependent',
  'Provider',
  'TelemedicineFacility',
  'Department',
  
  // Claims and related tables
  'Claim',
  'ClaimAudit',
  'FraudAlert',
  'VettingRecord',
  'ApprovalCode',
  
  // Telemedicine tables
  'TelemedicineRequest',
  'TelemedicineAppointment',
  'LabOrder',
  'RadiologyOrder',
  'PharmacyOrder',
  
  // HR tables
  'Employee',
  'Attendance',
  'LeaveRequest',
  'Memo',
  'Payroll',
  'HrRule',
  
  // Financial tables
  'FinancialTransaction',
  'Payout',
  
  // Provider request tables
  'ProviderRequest',
  
  // Audit and system tables
  'AuditLog',
  'SystemConfig'
]

async function getTableNames() {
  try {
    // Get all table names from the database
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `
    return tables.map(t => t.table_name)
  } catch (error) {
    console.error('Error getting table names:', error)
    return []
  }
}

async function getTableData(tableName) {
  try {
    const data = await prisma.$queryRawUnsafe(`SELECT * FROM "${tableName}"`)
    return data
  } catch (error) {
    console.error(`Error getting data from table ${tableName}:`, error)
    return []
  }
}

async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.join(__dirname, '..', 'backups', 'data')
  const backupFile = path.join(backupDir, `data-backup-${timestamp}.json`)
  
  // Ensure backup directory exists
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }
  
  console.log('🚀 Starting Database Backup Process...')
  console.log(`📊 Database: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) : 'NOT SET'}...`)
  console.log(`💾 Backup file: ${backupFile}`)
  
  try {
    // Test connection
    console.log('\n🔌 Testing database connection...')
    await prisma.$connect()
    console.log('✓ Database connected')
    
    // Get all table names
    console.log('\n📋 Getting table list...')
    const allTables = await getTableNames()
    console.log(`Found ${allTables.length} tables: ${allTables.join(', ')}`)
    
    // Filter tables that exist in our ordered list
    const orderedTables = TABLE_ORDER.filter(table => allTables.includes(table))
    const unorderedTables = allTables.filter(table => !TABLE_ORDER.includes(table))
    const tablesToProcess = [...orderedTables, ...unorderedTables]
    
    console.log(`\n📝 Processing ${tablesToProcess.length} tables...`)
    
    const backupData = {
      timestamp: new Date().toISOString(),
      database_url: process.env.DATABASE_URL,
      tables: {}
    }
    
    let totalRows = 0
    
    // Backup each table
    for (const tableName of tablesToProcess) {
      console.log(`\n📋 Processing table: ${tableName}`)
      
      const data = await getTableData(tableName)
      console.log(`   Found ${data.length} rows`)
      
      backupData.tables[tableName] = data
      totalRows += data.length
    }
    
    // Write backup file
    console.log(`\n💾 Writing backup file...`)
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2))
    
    console.log('\n🎉 Database backup completed successfully!')
    console.log(`✅ Backed up ${tablesToProcess.length} tables`)
    console.log(`✅ Total rows: ${totalRows}`)
    console.log(`✅ Backup file: ${backupFile}`)
    
    return backupFile
    
  } catch (error) {
    console.error('\n❌ Database backup failed:', error)
    throw error
  } finally {
    // Close connection
    await prisma.$disconnect()
    console.log('\n🔌 Database connection closed')
  }
}

// Run the script
if (require.main === module) {
  createBackup().catch(console.error)
}

module.exports = { createBackup }
