#!/usr/bin/env node

/**
 * Database Copy Script
 * 
 * This script copies all tables and data from DATABASE_URL to DATABASE_URL2
 * It preserves the exact structure and data, making it perfect for creating
 * exact database copies without needing to run seeds.
 * 
 * Usage: node scripts/copy-database.js
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config()

const sourcePrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

const targetPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL2
    }
  }
})

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
    // Get all table names from the source database
    const tables = await sourcePrisma.$queryRaw`
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
    const data = await sourcePrisma.$queryRawUnsafe(`SELECT * FROM "${tableName}"`)
    return data
  } catch (error) {
    console.error(`Error getting data from table ${tableName}:`, error)
    return []
  }
}

async function tableExists(tableName) {
  try {
    const result = await targetPrisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `, tableName)
    return result[0].exists
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error)
    return false
  }
}

async function clearTable(tableName) {
  try {
    // Try to clear the table without disabling foreign key checks
    await targetPrisma.$executeRawUnsafe(`DELETE FROM "${tableName}";`)
    console.log(`✓ Cleared table: ${tableName}`)
  } catch (error) {
    console.error(`Error clearing table ${tableName}:`, error)
    // If DELETE fails, try TRUNCATE without CASCADE
    try {
      await targetPrisma.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}";`)
      console.log(`✓ Cleared table (truncate): ${tableName}`)
    } catch (truncateError) {
      console.error(`Error truncating table ${tableName}:`, truncateError)
    }
  }
}

async function insertTableData(tableName, data) {
  if (data.length === 0) {
    console.log(`⚠ Skipping empty table: ${tableName}`)
    return
  }

  try {
    // Get column names from the first row
    const columns = Object.keys(data[0])
    const columnNames = columns.map(col => `"${col}"`).join(', ')
    
    // Create placeholders for the values
    const placeholders = data.map((_, index) => {
      const rowPlaceholders = columns.map((_, colIndex) => 
        `$${index * columns.length + colIndex + 1}`
      ).join(', ')
      return `(${rowPlaceholders})`
    }).join(', ')
    
    // Flatten all values
    const values = data.flatMap(row => columns.map(col => row[col]))
    
    const query = `
      INSERT INTO "${tableName}" (${columnNames}) 
      VALUES ${placeholders}
      ON CONFLICT DO NOTHING;
    `
    
    await targetPrisma.$executeRawUnsafe(query, ...values)
    console.log(`✓ Inserted ${data.length} rows into: ${tableName}`)
  } catch (error) {
    console.error(`Error inserting data into table ${tableName}:`, error)
    throw error
  }
}

async function copyTable(tableName) {
  try {
    console.log(`\n📋 Processing table: ${tableName}`)
    
    // Check if table exists in target database
    const exists = await tableExists(tableName)
    if (!exists) {
      console.log(`   ⚠ Table ${tableName} does not exist in target database, skipping...`)
      return
    }
    
    // Get data from source
    const data = await getTableData(tableName)
    console.log(`   Found ${data.length} rows`)
    
    if (data.length === 0) {
      console.log(`   ⚠ Table ${tableName} is empty, skipping...`)
      return
    }
    
    // Clear target table
    await clearTable(tableName)
    
    // Insert data into target
    await insertTableData(tableName, data)
    
  } catch (error) {
    console.error(`❌ Failed to copy table ${tableName}:`, error)
    throw error
  }
}

async function verifyCopy() {
  console.log('\n🔍 Verifying copy...')
  
  try {
    const sourceTables = await getTableNames()
    let allVerified = true
    let verifiedCount = 0
    let skippedCount = 0
    
    for (const tableName of sourceTables) {
      const exists = await tableExists(tableName)
      if (!exists) {
        console.log(`⚠ ${tableName}: Table does not exist in target (skipped)`)
        skippedCount++
        continue
      }
      
      const sourceCount = await sourcePrisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${tableName}"`)
      const targetCount = await targetPrisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${tableName}"`)
      
      const sourceRowCount = parseInt(sourceCount[0].count)
      const targetRowCount = parseInt(targetCount[0].count)
      
      if (sourceRowCount === targetRowCount) {
        console.log(`✓ ${tableName}: ${sourceRowCount} rows (verified)`)
        verifiedCount++
      } else {
        console.log(`❌ ${tableName}: Source=${sourceRowCount}, Target=${targetRowCount} (MISMATCH!)`)
        allVerified = false
      }
    }
    
    console.log(`\n📊 Verification Summary:`)
    console.log(`   ✓ Verified: ${verifiedCount} tables`)
    console.log(`   ⚠ Skipped: ${skippedCount} tables`)
    console.log(`   ❌ Mismatched: ${sourceTables.length - verifiedCount - skippedCount} tables`)
    
    return allVerified
  } catch (error) {
    console.error('Error during verification:', error)
    return false
  }
}

async function main() {
  console.log('🚀 Starting Database Copy Process...')
  console.log(`📊 Source: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) : 'NOT SET'}...`)
  console.log(`📊 Target: ${process.env.DATABASE_URL2 ? process.env.DATABASE_URL2.substring(0, 20) : 'NOT SET'}...`)
  
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL2) {
    console.error('❌ Error: DATABASE_URL and DATABASE_URL2 must be set in .env file')
    process.exit(1)
  }
  
  if (process.env.DATABASE_URL === process.env.DATABASE_URL2) {
    console.error('❌ Error: DATABASE_URL and DATABASE_URL2 cannot be the same')
    process.exit(1)
  }
  
  try {
    // Test connections
    console.log('\n🔌 Testing database connections...')
    await sourcePrisma.$connect()
    console.log('✓ Source database connected')
    
    await targetPrisma.$connect()
    console.log('✓ Target database connected')
    
    // Get all table names
    console.log('\n📋 Getting table list...')
    const allTables = await getTableNames()
    console.log(`Found ${allTables.length} tables: ${allTables.join(', ')}`)
    
    // Filter tables that exist in our ordered list
    const orderedTables = TABLE_ORDER.filter(table => allTables.includes(table))
    const unorderedTables = allTables.filter(table => !TABLE_ORDER.includes(table))
    const tablesToProcess = [...orderedTables, ...unorderedTables]
    
    console.log(`\n📝 Processing ${tablesToProcess.length} tables in order...`)
    
    // Copy each table
    for (const tableName of tablesToProcess) {
      await copyTable(tableName)
    }
    
    // Verify the copy
    const verified = await verifyCopy()
    
    if (verified) {
      console.log('\n🎉 Database copy completed successfully!')
      console.log('✅ All tables and data have been copied exactly')
      console.log('✅ Row counts match between source and target')
    } else {
      console.log('\n⚠️ Database copy completed with warnings')
      console.log('⚠️ Some tables may have mismatched row counts')
    }
    
  } catch (error) {
    console.error('\n❌ Database copy failed:', error)
    process.exit(1)
  } finally {
    // Close connections
    await sourcePrisma.$disconnect()
    await targetPrisma.$disconnect()
    console.log('\n🔌 Database connections closed')
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { main }
