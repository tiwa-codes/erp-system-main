/**
 * Configuration for Safe Schema Sync
 */

module.exports = {
  // Backup settings
  backup: {
    // Directory for schema backups
    schemaBackupDir: '../backups/schema',
    
    // Directory for data backups
    dataBackupDir: '../backups/data',
    
    // Maximum number of backups to keep (0 = unlimited)
    maxBackups: 10,
    
    // Backup retention period in days (0 = never delete)
    retentionDays: 30,
  },
  
  // Database settings
  database: {
    // Whether to create data backups automatically
    autoDataBackup: true,
    
    // Tables to include in data backup (empty = all tables)
    includeTables: [
      'users',
      'departments', 
      'permissions',
      'organizations',
      'providers',
      'employees',
      'claims',
      'financial_transactions',
      'principals',
      'dependents',
      'plans',
    ],
    
    // Tables to exclude from data backup
    excludeTables: [
      'audit_logs', // Usually too large and not critical for schema changes
    ],
  },
  
  // Safety settings
  safety: {
    // Require confirmation before destructive operations
    requireConfirmation: true,
    
    // Show detailed change preview
    showDetailedPreview: true,
    
    // Validate schema before applying changes
    validateBeforeApply: true,
    
    // Create backups before applying changes
    backupBeforeApply: true,
  },
  
  // Development settings
  development: {
    // Show warnings for potentially destructive changes
    showDestructiveWarnings: true,
    
    // Suggest safer alternatives for destructive changes
    suggestAlternatives: true,
    
    // Log all operations for debugging
    enableLogging: true,
  }
};
