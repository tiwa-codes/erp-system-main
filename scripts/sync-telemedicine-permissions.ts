/**
 * Sync permissions for TELEMEDICINE role users
 * This script adds telemedicine permissions to users with the TELEMEDICINE role
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function syncTelemedicinePermissions() {
  console.log('🔄 Syncing telemedicine permissions...\n')

  try {
    // Find the TELEMEDICINE role
    const telemedicineRole = await prisma.role.findFirst({
      where: { 
        name: { contains: 'TELEMEDICINE', mode: 'insensitive' }
      }
    })

    if (!telemedicineRole) {
      console.log('❌ TELEMEDICINE role not found in database')
      console.log('\nPlease create the TELEMEDICINE role first through the UI.')
      return
    }

    console.log(`✓ Found role: ${telemedicineRole.name} (ID: ${telemedicineRole.id})`)

    // Define the permissions for TELEMEDICINE role
    const telemedicinePermissions = [
      { module: 'dashboard', action: 'view' },
      { module: 'telemedicine', action: 'view' },
      { module: 'telemedicine', action: 'add' },
      { module: 'telemedicine', action: 'edit' },
      { module: 'telemedicine', action: 'delete' },
      { module: 'telemedicine', action: 'manage_facilities' },
      { module: 'telemedicine', action: 'manage_appointments' },
      { module: 'telemedicine', action: 'view_claims' },
      { module: 'reports', action: 'view' }, // Allow telemedicine users to view reports (especially telemedicine reports)
    ]

    // Delete existing permissions for this role
    const deletedCount = await prisma.permission.deleteMany({
      where: { role_id: telemedicineRole.id }
    })
    console.log(`✓ Deleted ${deletedCount.count} existing permission(s)`)

    // Create new permissions
    const permissions = await prisma.permission.createMany({
      data: telemedicinePermissions.map(perm => ({
        role_id: telemedicineRole.id,
        module: perm.module,
        action: perm.action,
        allowed: true
      })),
      skipDuplicates: true
    })

    console.log(`✓ Created ${permissions.count} permission(s) for TELEMEDICINE role\n`)

    // Count users with this role
    const userCount = await prisma.user.count({
      where: { role_id: telemedicineRole.id }
    })

    console.log(`✓ Found ${userCount} user(s) with TELEMEDICINE role`)
    console.log('\n✅ Permissions synced successfully!\n')

  } catch (error) {
    console.error('❌ Error syncing permissions:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

syncTelemedicinePermissions()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })

