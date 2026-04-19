/**
 * Script to sync ALL roles' default permissions to database
 * This ensures all roles work correctly after Permission Matrix configuration
 * 
 * Run with: npx tsx scripts/sync-all-permissions.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Default permissions for each role (from lib/permissions.ts)
const rolePermissions: Record<string, Array<{ module: string; action: string }>> = {
  ADMIN: [
    { module: "dashboard", action: "view" },
    { module: "hr", action: "view" },
    { module: "hr", action: "add" },
    { module: "hr", action: "edit" },
    { module: "hr", action: "manage_employees" },
    { module: "hr", action: "manage_attendance" },
    { module: "hr", action: "manage_leave" },
    { module: "claims", action: "view" },
    { module: "claims", action: "add" },
    { module: "claims", action: "edit" },
    { module: "claims", action: "vet" },
    { module: "claims", action: "audit" },
    { module: "finance", action: "view" },
    { module: "finance", action: "add" },
    { module: "finance", action: "edit" },
    { module: "finance", action: "process_payouts" },
    { module: "provider", action: "view" },
    { module: "provider", action: "add" },
    { module: "provider", action: "edit" },
    { module: "provider", action: "approve" },
    { module: "provider", action: "manage_risk" },
    { module: "provider", action: "manage_tariff_plan" },
    { module: "providers", action: "view" },
    { module: "providers", action: "add" },
    { module: "providers", action: "edit" },
    { module: "providers", action: "approve" },
    { module: "underwriting", action: "view" },
    { module: "underwriting", action: "add" },
    { module: "underwriting", action: "edit" },
    { module: "underwriting", action: "manage_organizations" },
    { module: "underwriting", action: "manage_principals" },
    { module: "underwriting", action: "manage_dependents" },
    { module: "call-centre", action: "view" },
    { module: "call-centre", action: "add" },
    { module: "call-centre", action: "edit" },
    { module: "call-centre", action: "manage_requests" },
    { module: "call-centre", action: "verify_codes" },
    { module: "call-centre", action: "check_coverage" },
    { module: "reports", action: "view" },
    { module: "reports", action: "generate_all" },
    { module: "reports", action: "view_all" },
    { module: "settings", action: "view" },
    { module: "settings", action: "add" },
    { module: "settings", action: "edit" },
    { module: "fraud-detection", action: "view" },
    { module: "fraud-detection", action: "add" },
    { module: "fraud-detection", action: "edit" },
    { module: "fraud-detection", action: "investigate" },
    { module: "fraud-detection", action: "approve" },
    { module: "fraud-detection", action: "reject" },
    { module: "users", action: "view" },
    { module: "users", action: "add" },
    { module: "users", action: "edit" },
    { module: "department-oversight", action: "view" },
    { module: "department-oversight", action: "add" },
    { module: "department-oversight", action: "edit" },
    { module: "department-oversight", action: "delete" },
    { module: "operation-desk", action: "view" },
    { module: "operation-desk", action: "add" },
    { module: "operation-desk", action: "edit" },
    { module: "operation-desk", action: "delete" },
    { module: "executive-desk", action: "view" },
    { module: "executive-desk", action: "add" },
    { module: "executive-desk", action: "edit" },
    { module: "executive-desk", action: "delete" },
    { module: "telemedicine", action: "view" },
    { module: "telemedicine", action: "add" },
  ],
  HR_MANAGER: [
    { module: "dashboard", action: "view" },
    { module: "hr", action: "view" },
    { module: "hr", action: "add" },
    { module: "hr", action: "edit" },
    { module: "hr", action: "delete" },
    { module: "hr", action: "manage_employees" },
    { module: "hr", action: "manage_attendance" },
    { module: "hr", action: "manage_leave" },
    { module: "hr", action: "manage_memos" },
    { module: "hr", action: "manage_rules" },
    { module: "hr", action: "manage_payroll" },
    { module: "hr", action: "procurement" },
    { module: "department-oversight", action: "view" },
    { module: "department-oversight", action: "add" },
    { module: "department-oversight", action: "edit" },
    { module: "department-oversight", action: "delete" },
    { module: "operation-desk", action: "view" },
    { module: "operation-desk", action: "add" },
    { module: "reports", action: "view" },
    { module: "reports", action: "generate_hr" },
    { module: "settings", action: "view" },
    { module: "telemedicine", action: "view" },
  ],
  HR_OFFICER: [
    { module: "dashboard", action: "view" },
    { module: "hr", action: "view" },
    { module: "hr", action: "add" },
    { module: "hr", action: "edit" },
    { module: "hr", action: "manage_employees" },
    { module: "hr", action: "manage_attendance" },
    { module: "hr", action: "manage_leave" },
    { module: "department-oversight", action: "view" },
    { module: "operation-desk", action: "view" },
    { module: "reports", action: "view" },
    { module: "settings", action: "view" },
    { module: "telemedicine", action: "view" },
  ],
  CLAIMS_MANAGER: [
    { module: "dashboard", action: "view" },
    { module: "claims", action: "view" },
    { module: "claims", action: "add" },
    { module: "claims", action: "edit" },
    { module: "claims", action: "delete" },
    { module: "claims", action: "vet" },
    { module: "claims", action: "audit" },
    { module: "claims", action: "approve" },
    { module: "claims", action: "fraud_detection" },
    { module: "claims", action: "procurement" },
    { module: "department-oversight", action: "view" },
    { module: "department-oversight", action: "add" },
    { module: "department-oversight", action: "edit" },
    { module: "department-oversight", action: "delete" },
    { module: "operation-desk", action: "view" },
    { module: "operation-desk", action: "add" },
    { module: "fraud-detection", action: "view" },
    { module: "fraud-detection", action: "investigate" },
    { module: "fraud-detection", action: "approve" },
    { module: "reports", action: "view" },
    { module: "reports", action: "generate_claims" },
    { module: "settings", action: "view" },
    { module: "telemedicine", action: "view" },
    { module: "telemedicine", action: "view_claims" },
  ],
  CLAIMS_PROCESSOR: [
    { module: "dashboard", action: "view" },
    { module: "claims", action: "view" },
    { module: "claims", action: "add" },
    { module: "claims", action: "vet" },
    { module: "department-oversight", action: "view" },
    { module: "operation-desk", action: "view" },
    { module: "fraud-detection", action: "view" },
    { module: "reports", action: "view" },
    { module: "settings", action: "view" },
    { module: "telemedicine", action: "view" },
  ],
  FINANCE_OFFICER: [
    { module: "dashboard", action: "view" },
    { module: "finance", action: "view" },
    { module: "finance", action: "add" },
    { module: "finance", action: "edit" },
    { module: "finance", action: "manage_accounts" },
    { module: "finance", action: "process_payouts" },
    { module: "claims", action: "view" },
    { module: "fraud-detection", action: "view" },
    { module: "reports", action: "view" },
    { module: "reports", action: "generate_finance" },
    { module: "settings", action: "view" },
    { module: "telemedicine", action: "view" },
    { module: "telemedicine", action: "add" },
    { module: "telemedicine", action: "edit" },
    { module: "telemedicine", action: "view_claims" },
  ],
  PROVIDER_MANAGER: [
    { module: "dashboard", action: "view" },
    { module: "provider", action: "view" },
    { module: "provider", action: "add" },
    { module: "provider", action: "edit" },
    { module: "provider", action: "delete" },
    { module: "provider", action: "approve" },
    { module: "provider", action: "manage_risk" },
    { module: "provider", action: "manage_inpatients" },
    { module: "provider", action: "manage_tariff_plan" },
    { module: "provider", action: "procurement" },
    { module: "providers", action: "view" },
    { module: "providers", action: "add" },
    { module: "providers", action: "edit" },
    { module: "providers", action: "delete" },
    { module: "providers", action: "approve" },
    { module: "claims", action: "view" },
    { module: "fraud-detection", action: "view" },
    { module: "fraud-detection", action: "investigate" },
    { module: "reports", action: "view" },
    { module: "reports", action: "generate_provider" },
    { module: "settings", action: "view" },
    { module: "telemedicine", action: "view" },
    { module: "telemedicine", action: "add" },
    { module: "telemedicine", action: "edit" },
    { module: "telemedicine", action: "delete" },
    { module: "telemedicine", action: "manage_facilities" },
    { module: "telemedicine", action: "manage_appointments" },
    { module: "telemedicine", action: "view_claims" },
  ],
  UNDERWRITER: [
    { module: "dashboard", action: "view" },
    { module: "underwriting", action: "view" },
    { module: "underwriting", action: "add" },
    { module: "underwriting", action: "edit" },
    { module: "underwriting", action: "delete" },
    { module: "underwriting", action: "manage_organizations" },
    { module: "underwriting", action: "manage_principals" },
    { module: "underwriting", action: "manage_dependents" },
    { module: "underwriting", action: "manage_plans" },
    { module: "underwriting", action: "procurement" },
    { module: "fraud-detection", action: "view" },
    { module: "reports", action: "view" },
    { module: "reports", action: "generate_underwriting" },
    { module: "settings", action: "view" },
    { module: "settings", action: "add" },
    { module: "settings", action: "edit" },
    { module: "telemedicine", action: "view" },
    { module: "telemedicine", action: "view_claims" },
  ],
  PROVIDER: [
    { module: "dashboard", action: "view" },
    { module: "providers", action: "view" },
    { module: "providers", action: "add" },
    { module: "claims", action: "view" },
    { module: "claims", action: "add" },
  ],
}

async function syncAllRolePermissions() {
  console.log('🔄 Syncing ALL roles default permissions to database...\n')

  try {
    const roles = Object.keys(rolePermissions)
    
    for (const roleName of roles) {
      console.log(`\n📝 Processing role: ${roleName}`)
      
      // Get role from database
      const role = await prisma.role.findFirst({
        where: { name: roleName }
      })

      if (!role) {
        console.log(`  ⚠️  Role ${roleName} not found in database, skipping...`)
        continue
      }

      const permissions = rolePermissions[roleName]
      console.log(`  ℹ️  Syncing ${permissions.length} permissions...`)

      let created = 0
      let updated = 0

      for (const perm of permissions) {
        // Check if permission exists
        const existing = await prisma.permission.findFirst({
          where: {
            role_id: role.id,
            module: perm.module,
            action: perm.action,
            submodule: null,
          }
        })

        if (existing) {
          // Update if not allowed
          if (!existing.allowed) {
            await prisma.permission.update({
              where: { id: existing.id },
              data: { allowed: true }
            })
            updated++
          }
        } else {
          // Create new permission
          await prisma.permission.create({
            data: {
              role_id: role.id,
              module: perm.module,
              action: perm.action,
              submodule: null,
              allowed: true
            }
          })
          created++
        }
      }

      console.log(`  ✅ Created: ${created}, Updated: ${updated}`)
    }

    console.log('\n\n✅ Successfully synced all role permissions!')
    console.log('\n💡 Tips:')
    console.log('  - You can now manage these permissions via the Permission Matrix UI')
    console.log('  - Unchecking permissions in the matrix will now properly restrict access')
    console.log('  - Checking permissions in the matrix will grant access')
    
  } catch (error) {
    console.error('❌ Error syncing permissions:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

syncAllRolePermissions()
