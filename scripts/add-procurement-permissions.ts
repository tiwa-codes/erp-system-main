/**
 * Script to add procurement permissions to all roles that need them.
 * Safe to run multiple times — skips existing entries.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Map of role name → modules that need procurement permission
const ROLE_PROCUREMENT_MODULES: Record<string, string[]> = {
  ADMIN: ['hr', 'claims', 'finance', 'provider', 'underwriting', 'call-centre', 'telemedicine', 'legal'],
  SUPER_ADMIN: ['hr', 'claims', 'finance', 'provider', 'underwriting', 'call-centre', 'telemedicine', 'legal'],
}

async function addProcurementPermissions() {
  console.log('🔄 Adding procurement permissions...\n')

  try {
    let totalCreated = 0
    let totalSkipped = 0

    for (const [roleName, modules] of Object.entries(ROLE_PROCUREMENT_MODULES)) {
      const role = await prisma.role.findFirst({ where: { name: roleName } })
      if (!role) {
        console.log(`⚠️  Role ${roleName} not found — skipping`)
        continue
      }

      console.log(`📋 Role: ${roleName} (ID: ${role.id})`)

      for (const module of modules) {
        const existing = await prisma.permission.findFirst({
          where: { role_id: role.id, module, action: 'procurement', submodule: null },
        })

        if (existing) {
          console.log(`  ⏭️  Skipped: ${module}:procurement (already exists)`)
          totalSkipped++
        } else {
          await prisma.permission.create({
            data: { role_id: role.id, module, action: 'procurement', submodule: null, allowed: true },
          })
          console.log(`  ✅ Created: ${module}:procurement`)
          totalCreated++
        }
      }
    }

    console.log(`\n📊 Summary: Created ${totalCreated}, Skipped ${totalSkipped}`)
    console.log('\n✅ Done!')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

addProcurementPermissions()
