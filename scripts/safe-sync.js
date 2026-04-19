const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Safe Schema Sync - Complete Workflow
 * This script provides a complete safe workflow for schema changes
 */

const SCHEMA_SYNC_SCRIPT = path.join(__dirname, 'schema-sync.js');
const DATA_BACKUP_SCRIPT = path.join(__dirname, 'data-backup.js');

function runCommand(script, args = []) {
  try {
    const command = `node ${script} ${args.join(' ')}`;
    console.log(`🔄 Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`❌ Command failed: ${script}`, error.message);
    return false;
  }
}

function showWarning() {
  console.log(`
⚠️  SAFE SCHEMA SYNC WORKFLOW
================================

This workflow will:
1. ✅ Create a backup of your current schema
2. ✅ Create a backup of your critical data
3. ✅ Validate the Prisma schema
4. ✅ Show you what changes will be made
5. ✅ Ask for confirmation before applying changes
6. ✅ Apply changes safely
7. ✅ Generate new Prisma client

This helps prevent data loss during development.
`);
}

function askConfirmation(message) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim());
    });
  });
}

async function safeSyncWorkflow() {
  showWarning();
  
  console.log('🚀 Starting Safe Schema Sync Workflow...\n');
  
  // Step 1: Create schema backup
  console.log('📋 Step 1: Creating schema backup...');
  if (!runCommand(SCHEMA_SYNC_SCRIPT, ['backup'])) {
    console.log('❌ Failed to create schema backup. Aborting.');
    return;
  }
  
  // Step 2: Create data backup
  console.log('\n📋 Step 2: Creating data backup...');
  if (!runCommand(DATA_BACKUP_SCRIPT, ['backup'])) {
    console.log('❌ Failed to create data backup. Aborting.');
    return;
  }
  
  // Step 3: Validate schema
  console.log('\n📋 Step 3: Validating schema...');
  if (!runCommand(SCHEMA_SYNC_SCRIPT, ['validate'])) {
    console.log('❌ Schema validation failed. Aborting.');
    return;
  }
  
  // Step 4: Show changes
  console.log('\n📋 Step 4: Showing what changes will be made...');
  runCommand(SCHEMA_SYNC_SCRIPT, ['dry-run']);
  
  // Step 5: Ask for confirmation
  console.log('\n❓ Do you want to proceed with these changes? (yes/no)');
  const confirmation = await askConfirmation('> ');
  
  if (confirmation !== 'yes' && confirmation !== 'y') {
    console.log('❌ Operation cancelled by user.');
    return;
  }
  
  // Step 6: Apply changes
  console.log('\n📋 Step 5: Applying schema changes...');
  if (!runCommand(SCHEMA_SYNC_SCRIPT, ['push'])) {
    console.log('❌ Failed to apply schema changes.');
    console.log('💡 You can restore from backup if needed.');
    return;
  }
  
  console.log('\n🎉 Safe Schema Sync completed successfully!');
  console.log('✅ Your schema has been updated safely.');
  console.log('💾 Backups are available in the backups/ directory.');
}

function showHelp() {
  console.log(`
🛡️  Safe Schema Sync - Complete Workflow

Usage: node safe-sync.js [command]

Commands:
  sync       - Run the complete safe sync workflow (default)
  help       - Show this help message

The safe sync workflow:
1. Creates schema backup
2. Creates data backup  
3. Validates schema
4. Shows preview of changes
5. Asks for confirmation
6. Applies changes safely
7. Generates Prisma client

This is the recommended way to make schema changes during development.
  `);
}

// Main execution
const command = process.argv[2] || 'sync';

switch (command) {
  case 'sync':
    safeSyncWorkflow();
    break;
    
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;
    
  default:
    console.log('❌ Unknown command. Use "help" for usage information.');
    break;
}
