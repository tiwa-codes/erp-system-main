/**
 * Script to fix PROVIDER role permissions
 * PROVIDER should ONLY have access to "providers" module
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixProviderPermissions() {
  console.log('🔧 Fixing PROVIDER role permissions...\n')

  try {
    // Get PROVIDER role
    const providerRole = await prisma.role.findFirst({
      where: { name: 'PROVIDER' }
    })

    if (!providerRole) {
      console.error('❌ PROVIDER role not found')
      process.exit(1)
    }

    console.log(`✅ Found PROVIDER role (ID: ${providerRole.id})\n`)

    // Step 1: Delete ALL existing PROVIDER permissions
    const deleted = await prisma.permission.deleteMany({
      where: { role_id: providerRole.id }
    })
    console.log(`🗑️  Deleted ${deleted.count} existing permissions\n`)

    // Step 2: Create ONLY "providers" module permissions
    const correctPermissions = [
      { module: "dashboard", action: "view" },
      { module: "providers", action: "view" },
      { module: "providers", action: "add" },
    ]

    console.log(`📋 Creating ${correctPermissions.length} correct permissions...\n`)

    for (const perm of correctPermissions) {
      await prisma.permission.create({
        data: {
          role_id: providerRole.id,
          module: perm.module,
          action: perm.action,
          submodule: null,
          allowed: true
        }
      })
      console.log(`  ✓ ${perm.module}:${perm.action}`)
    }

    console.log('\n✅ PROVIDER permissions fixed!')
    console.log('\n📌 PROVIDER now has access to:')
    console.log('  - Dashboard (view only)')
    console.log('  - Providers module (view and add)')
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

fixProviderPermissions()
