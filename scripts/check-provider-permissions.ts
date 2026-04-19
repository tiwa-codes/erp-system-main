/**
 * Script to check PROVIDER role permissions in database
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkProviderPermissions() {
  try {
    // Get PROVIDER role
    const providerRole = await prisma.role.findFirst({
      where: { name: 'PROVIDER' }
    })

    if (!providerRole) {
      console.error('❌ PROVIDER role not found')
      process.exit(1)
    }

    // Get all permissions for PROVIDER
    const permissions = await prisma.permission.findMany({
      where: {
        role_id: providerRole.id,
        allowed: true
      },
      orderBy: [
        { module: 'asc' },
        { action: 'asc' }
      ]
    })

    console.log('\n📋 PROVIDER Role Permissions:\n')
    
    // Group by module
    const byModule: Record<string, string[]> = {}
    
    for (const perm of permissions) {
      if (!byModule[perm.module]) {
        byModule[perm.module] = []
      }
      byModule[perm.module].push(perm.action)
    }

    // Display grouped
    for (const [module, actions] of Object.entries(byModule)) {
      console.log(`\n${module}:`)
      actions.forEach(action => {
        console.log(`  - ${action}`)
      })
    }

    console.log('\n\nTotal permissions:', permissions.length)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkProviderPermissions()
