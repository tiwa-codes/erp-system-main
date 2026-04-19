const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

/**
 * Data Backup Utility
 * Creates JSON backups of critical data before schema changes
 */

const prisma = new PrismaClient();
const BACKUP_DIR = path.join(__dirname, '../backups/data');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function createDataBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `data-backup-${timestamp}.json`);
  
  try {
    console.log('🔄 Creating data backup...');
    
    // Backup critical tables
    const backup = {
      timestamp: new Date().toISOString(),
      users: await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          role: true,
          status: true,
          department_id: true,
          created_at: true,
        }
      }),
      departments: await prisma.department.findMany(),
      permissions: await prisma.permission.findMany(),
      organizations: await prisma.organization.findMany(),
      providers: await prisma.provider.findMany(),
      employees: await prisma.employee.findMany({
        select: {
          id: true,
          employee_id: true,
          first_name: true,
          last_name: true,
          email: true,
          position: true,
          department_id: true,
          hire_date: true,
          status: true,
          created_at: true,
        }
      }),
      claims: await prisma.claim.findMany({
        select: {
          id: true,
          claim_number: true,
          enrollee_id: true,
          principal_id: true,
          provider_id: true,
          claim_type: true,
          amount: true,
          status: true,
          submitted_at: true,
          created_at: true,
        }
      }),
      financial_transactions: await prisma.financialTransaction.findMany({
        select: {
          id: true,
          transaction_type: true,
          amount: true,
          currency: true,
          description: true,
          status: true,
          created_at: true,
        }
      }),
      principals: await prisma.principal.findMany({
        select: {
          id: true,
          principal_id: true,
          first_name: true,
          last_name: true,
          email: true,
          organization_id: true,
          status: true,
          created_at: true,
        }
      }),
      dependents: await prisma.dependent.findMany({
        select: {
          id: true,
          dependent_id: true,
          first_name: true,
          last_name: true,
          date_of_birth: true,
          relationship: true,
          principal_id: true,
          status: true,
          created_at: true,
        }
      }),
      plans: await prisma.plan.findMany({
        select: {
          id: true,
          plan_code: true,
          name: true,
          description: true,
          organization_id: true,
          status: true,
          created_at: true,
        }
      }),
    };
    
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    
    console.log(`✅ Data backup created: ${backupFile}`);
    console.log(`📊 Backup contains:`);
    console.log(`   - ${backup.users.length} users`);
    console.log(`   - ${backup.departments.length} departments`);
    console.log(`   - ${backup.permissions.length} permissions`);
    console.log(`   - ${backup.organizations.length} organizations`);
    console.log(`   - ${backup.providers.length} providers`);
    console.log(`   - ${backup.employees.length} employees`);
    console.log(`   - ${backup.claims.length} claims`);
    console.log(`   - ${backup.financial_transactions.length} financial transactions`);
    console.log(`   - ${backup.principals.length} principals`);
    console.log(`   - ${backup.dependents.length} dependents`);
    console.log(`   - ${backup.plans.length} plans`);
    
    return backupFile;
  } catch (error) {
    console.error('❌ Failed to create data backup:', error.message);
    throw error;
  }
}

async function restoreDataBackup(backupFile) {
  try {
    if (!fs.existsSync(backupFile)) {
      console.error('❌ Backup file not found:', backupFile);
      return false;
    }
    
    console.log('🔄 Restoring data from backup...');
    const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    
    // Note: This is a basic restore. In production, you'd want more sophisticated logic
    console.log('⚠️  WARNING: Data restore is not fully implemented for safety.');
    console.log('   This backup is for reference only.');
    console.log('   Manual data restoration may be required.');
    
    console.log(`📊 Backup contains data from: ${backup.timestamp}`);
    console.log(`   - ${backup.users.length} users`);
    console.log(`   - ${backup.departments.length} departments`);
    console.log(`   - ${backup.permissions.length} permissions`);
    console.log(`   - ${backup.organizations.length} organizations`);
    console.log(`   - ${backup.providers.length} providers`);
    console.log(`   - ${backup.employees.length} employees`);
    console.log(`   - ${backup.claims.length} claims`);
    console.log(`   - ${backup.financial_transactions.length} financial transactions`);
    console.log(`   - ${backup.principals.length} principals`);
    console.log(`   - ${backup.dependents.length} dependents`);
    console.log(`   - ${backup.plans.length} plans`);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to restore data backup:', error.message);
    return false;
  }
}

function listDataBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.endsWith('.json'))
      .sort()
      .reverse();
    
    if (files.length === 0) {
      console.log('📁 No data backups found');
      return [];
    }
    
    console.log('📁 Available data backups:');
    files.forEach((file, index) => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const date = stats.mtime.toLocaleString();
      const size = (stats.size / 1024).toFixed(2) + ' KB';
      console.log(`  ${index + 1}. ${file} (${date}, ${size})`);
    });
    
    return files;
  } catch (error) {
    console.error('❌ Failed to list data backups:', error.message);
    return [];
  }
}

// Main execution
const command = process.argv[2];
const arg = process.argv[3];

async function main() {
  try {
    switch (command) {
      case 'backup':
        await createDataBackup();
        break;
        
      case 'restore':
        if (arg) {
          const backupFile = path.join(BACKUP_DIR, arg);
          await restoreDataBackup(backupFile);
        } else {
          console.log('❌ Please specify backup file name');
          console.log('Usage: node data-backup.js restore <backup-file-name>');
        }
        break;
        
      case 'list':
        listDataBackups();
        break;
        
      default:
        console.log(`
💾 Data Backup Utility

Usage: node data-backup.js <command> [options]

Commands:
  backup     - Create a backup of critical data
  restore    - Show backup information (restore not fully implemented for safety)
  list       - List available data backups

Examples:
  node data-backup.js backup           # Create data backup
  node data-backup.js list             # Show backups
  node data-backup.js restore data-backup-2024-01-15T10-30-00-000Z.json
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
