import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function revertAdminRole() {
  try {
    // Get SUPER_ADMIN role
    const superAdminRole = await prisma.role.findUnique({
      where: { name: 'SUPER_ADMIN' },
    })

    if (!superAdminRole) {
      console.error('❌ SUPER_ADMIN role not found!')
      return
    }

    // Update admin user back to SUPER_ADMIN
    const updated = await prisma.user.update({
      where: { email: 'admin@erp.com' },
      data: { role_id: superAdminRole.id },
      include: { role: true },
    })

    console.log('✅ Successfully reverted admin role!')
    console.log(`Email: ${updated.email}`)
    console.log(`New role: ${updated.role?.name}`)
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

revertAdminRole()
