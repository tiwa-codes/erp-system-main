import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addCallCentrePermissions() {
  try {
    // Get SUPER_ADMIN role
    const superAdminRole = await prisma.role.findUnique({
      where: { name: 'SUPER_ADMIN' },
    })

    if (!superAdminRole) {
      console.error('❌ SUPER_ADMIN role not found!')
      return
    }

    console.log(`✅ Found SUPER_ADMIN role with ID: ${superAdminRole.id}`)

    // Call Centre permissions to add
    const callCentrePermissions = [
      { module: 'call-centre', action: 'view' },
      { module: 'call-centre', action: 'add' },
      { module: 'call-centre', action: 'edit' },
      { module: 'call-centre', action: 'delete' },
      { module: 'call-centre', action: 'manage_requests' },
      { module: 'call-centre', action: 'verify_codes' },
      { module: 'call-centre', action: 'check_coverage' },
    ]

    let created = 0
    let existing = 0

    for (const perm of callCentrePermissions) {
      const existingPerm = await prisma.permission.findFirst({
        where: {
          role_id: superAdminRole.id,
          module: perm.module,
          action: perm.action,
        },
      })

      if (existingPerm) {
        console.log(`⚠️ Already exists: ${perm.module}.${perm.action}`)
        existing++
        
        // Update to ensure it's allowed
        await prisma.permission.update({
          where: { id: existingPerm.id },
          data: { allowed: true },
        })
      } else {
        await prisma.permission.create({
          data: {
            role_id: superAdminRole.id,
            module: perm.module,
            submodule: null,
            action: perm.action,
            allowed: true,
          },
        })
        console.log(`✅ Created: ${perm.module}.${perm.action}`)
        created++
      }
    }

    console.log(`\n✅ Successfully added Call Centre permissions to SUPER_ADMIN!`)
    console.log(`Created: ${created}, Existing: ${existing}`)
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addCallCentrePermissions()
