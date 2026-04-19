/**
 * Script to add claims permissions to PROVIDER role
 * PROVIDER needs to view and add their own claims
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addProviderClaimsPermissions() {

  try {
    // Get PROVIDER role
    const providerRole = await prisma.role.findFirst({
      where: { name: 'PROVIDER' }
    })

    if (!providerRole) {
      console.error('❌ PROVIDER role not found')
      process.exit(1)
    }


    // Add claims permissions
    const claimsPermissions = [
      { module: "claims", action: "view" },  // View their own claims
      { module: "claims", action: "add" },   // Submit new claims
    ]


    for (const perm of claimsPermissions) {
      // Check if exists
      const existing = await prisma.permission.findFirst({
        where: {
          role_id: providerRole.id,
          module: perm.module,
          action: perm.action,
          submodule: null,
        }
      })

      if (existing) {
      } else {
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
    }

  } catch (error) {
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

addProviderClaimsPermissions()
