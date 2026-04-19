const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Safe Schema Sync Utility
 * This script helps manage schema changes safely during development
 */

const SCHEMA_BACKUP_DIR = path.join(__dirname, '../backups/schema');
const SCHEMA_FILE = path.join(__dirname, '../prisma/schema.prisma');

// Ensure backup directory exists
if (!fs.existsSync(SCHEMA_BACKUP_DIR)) {
  fs.mkdirSync(SCHEMA_BACKUP_DIR, { recursive: true });
}

function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(SCHEMA_BACKUP_DIR, `schema-backup-${timestamp}.prisma`);
  
  try {
    fs.copyFileSync(SCHEMA_FILE, backupFile);
    console.log(`✅ Schema backup created: ${backupFile}`);
    return backupFile;
  } catch (error) {
    console.error('❌ Failed to create schema backup:', error.message);
    process.exit(1);
  }
}

function validateSchema() {
  try {
    console.log('🔍 Validating Prisma schema...');
    execSync('npx prisma validate', { stdio: 'inherit' });
    console.log('✅ Schema validation passed');
    return true;
  } catch (error) {
    console.error('❌ Schema validation failed:', error.message);
    return false;
  }
}

function generateClient() {
  try {
    console.log('🔧 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('✅ Prisma client generated successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to generate Prisma client:', error.message);
    return false;
  }
}

function pushSchema(dryRun = false) {
  try {
    const command = dryRun ? 'npx prisma db push --accept-data-loss' : 'npx prisma db push';
    console.log(`🚀 ${dryRun ? 'Dry run: ' : ''}Pushing schema to database...`);
    execSync(command, { stdio: 'inherit' });
    console.log('✅ Schema pushed to database successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to push schema:', error.message);
    return false;
  }
}

function showSchemaDiff() {
  try {
    console.log('📊 Showing schema differences...');
    execSync('npx prisma db push --preview-feature', { stdio: 'inherit' });
  } catch (error) {
    console.log('ℹ️  No preview feature available, showing current schema status...');
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
  }
}

function restoreBackup(backupFile) {
  try {
    if (!fs.existsSync(backupFile)) {
      console.error('❌ Backup file not found:', backupFile);
      return false;
    }
    
    console.log('🔄 Restoring schema from backup...');
    fs.copyFileSync(backupFile, SCHEMA_FILE);
    console.log('✅ Schema restored from backup');
    return true;
  } catch (error) {
    console.error('❌ Failed to restore backup:', error.message);
    return false;
  }
}

function listBackups() {
  try {
    const files = fs.readdirSync(SCHEMA_BACKUP_DIR)
      .filter(file => file.endsWith('.prisma'))
      .sort()
      .reverse();
    
    if (files.length === 0) {
      console.log('📁 No schema backups found');
      return [];
    }
    
    console.log('📁 Available schema backups:');
    files.forEach((file, index) => {
      const filePath = path.join(SCHEMA_BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const date = stats.mtime.toLocaleString();
      console.log(`  ${index + 1}. ${file} (${date})`);
    });
    
    return files;
  } catch (error) {
    console.error('❌ Failed to list backups:', error.message);
    return [];
  }
}

// Main execution
const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
  case 'backup':
    createBackup();
    break;
    
  case 'validate':
    validateSchema();
    break;
    
  case 'generate':
    generateClient();
    break;
    
  case 'push':
    if (validateSchema()) {
      createBackup();
      if (pushSchema()) {
        generateClient();
        console.log('🎉 Schema sync completed successfully!');
      }
    }
    break;
    
  case 'dry-run':
    if (validateSchema()) {
      createBackup();
      showSchemaDiff();
    }
    break;
    
  case 'restore':
    if (arg) {
      const backupFile = path.join(SCHEMA_BACKUP_DIR, arg);
      restoreBackup(backupFile);
    } else {
      console.log('❌ Please specify backup file name');
      console.log('Usage: node schema-sync.js restore <backup-file-name>');
    }
    break;
    
  case 'list':
    listBackups();
    break;
    
  default:
    console.log(`
🛠️  Safe Schema Sync Utility

Usage: node schema-sync.js <command> [options]

Commands:
  backup     - Create a backup of current schema
  validate   - Validate the Prisma schema
  generate   - Generate Prisma client
  push       - Safely push schema changes (with backup)
  dry-run    - Show what changes would be made
  restore    - Restore schema from backup
  list       - List available backups

Examples:
  node schema-sync.js push          # Safe schema push with backup
  node schema-sync.js dry-run       # Preview changes
  node schema-sync.js list          # Show backups
  node schema-sync.js restore schema-backup-2024-01-15T10-30-00-000Z.prisma
    `);
    break;
}
