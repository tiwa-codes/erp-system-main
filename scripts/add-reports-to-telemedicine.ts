/**
 * Script to add reports:view permission to all TELEMEDICINE-related roles
 */

import { PrismaClient } from '@prisma/client'
import { invalidatePermissionCache } from '../lib/permissions'

const prisma = new PrismaClient()

async function addReportsPermission() {

  try {
    // Find all TELEMEDICINE-related roles
    const telemedicineRoles = await prisma.role.findMany({
      where: { 
        name: { contains: 'TELEMEDICINE', mode: 'insensitive' }
      }
    })

    if (telemedicineRoles.length === 0) {
      return
    }

    for (const role of telemedicineRoles) {

      // Check if reports:view permission already exists
      const existing = await prisma.permission.findFirst({
        where: {
          role_id: role.id,
          module: 'reports',
          action: 'view',
          submodule: null
        }
      })

      if (existing) {
        if (existing.allowed) {
        } else {
          // Update to allow it
          await prisma.permission.update({
            where: { id: existing.id },
            data: { allowed: true }
          })
        }
      } else {
        // Create new permission
        await prisma.permission.create({
          data: {
            role_id: role.id,
            module: 'reports',
            action: 'view',
            submodule: null,
            allowed: true
          }
        })
      }

      // Invalidate cache for this role
      invalidatePermissionCache(role.name as any)
    }

  } catch (error) {
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

addReportsPermission()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })

