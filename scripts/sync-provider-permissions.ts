/**
 * Script to sync PROVIDER role default permissions to database
 * This ensures PROVIDER role works correctly after Permission Matrix configuration
 * 
 * Run with: npx tsx scripts/sync-provider-permissions.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function syncProviderPermissions() {
  console.log('🔄 Syncing PROVIDER role default permissions to database...\n')

  try {
    // Get PROVIDER role
    const providerRole = await prisma.role.findFirst({
      where: { name: 'PROVIDER' }
    })

    if (!providerRole) {
      console.error('❌ PROVIDER role not found in database')
      process.exit(1)
    }

    console.log(`✅ Found PROVIDER role (ID: ${providerRole.id})\n`)

    // Default permissions for PROVIDER role
    const defaultPermissions = [
      { module: "dashboard", action: "view" },
      { module: "provider", action: "view" },
      { module: "providers", action: "view" },
      { module: "providers", action: "add" },
      { module: "claims", action: "view" },
      { module: "claims", action: "add" },
      { module: "call-centre", action: "view" },
      { module: "call-centre", action: "add" },
      { module: "underwriting", action: "view" },
      { module: "telemedicine", action: "view" },
      { module: "telemedicine", action: "add" },
      { module: "telemedicine", action: "edit" },
      { module: "telemedicine", action: "view_claims" },
    ]

    console.log(`📋 Syncing ${defaultPermissions.length} permissions...\n`)

    // Upsert each permission
    for (const perm of defaultPermissions) {
      // First, try to find existing permission
      const existing = await prisma.permission.findFirst({
        where: {
          role_id: providerRole.id,
          module: perm.module,
          action: perm.action,
          submodule: null,
        }
      })

      if (existing) {
        // Update existing
        await prisma.permission.update({
          where: { id: existing.id },
          data: { allowed: true }
        })
      } else {
        // Create new
        await prisma.permission.create({
          data: {
            role_id: providerRole.id,
            module: perm.module,
            action: perm.action,
            submodule: null,
            allowed: true
          }
        })
      }

      console.log(`  ✓ ${perm.module}:${perm.action}`)
    }

    console.log('\n✅ Successfully synced all PROVIDER permissions!')
    console.log('\n💡 Tip: You can now manage these permissions via the Permission Matrix UI')
    
  } catch (error) {
    console.error('❌ Error syncing permissions:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

syncProviderPermissions()
