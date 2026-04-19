import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkUserRole() {
  try {
    // Get the admin user (or current logged-in user)
    const user = await prisma.user.findUnique({
      where: { email: 'admin@erp.com' }, // Change this to your email if different
      include: {
        role: true
      }
    })

    if (!user) {
      console.log('❌ User not found!')
      return
    }

    console.log('👤 User Information:')
    console.log(`   Email: ${user.email}`)
    console.log(`   Name: ${user.first_name} ${user.last_name}`)
    console.log(`   Role ID: ${user.role_id}`)
    console.log(`   Role Name: ${user.role?.name || 'NULL'}`)
    console.log(`   Role Description: ${user.role?.description || 'NULL'}`)
    console.log()

    // Check what roles exist in the system
    console.log('📋 Available Roles in System:')
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' }
    })

    roles.forEach((role, index) => {
      console.log(`   ${index + 1}. ${role.name}`)
      console.log(`      ID: ${role.id}`)
      console.log(`      Description: ${role.description || 'N/A'}`)
      console.log(`      Active: ${role.is_active}`)
      console.log()
    })

    // Check vetter permissions for this user's role
    if (user.role) {
      const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'CLAIMS_PROCESSOR', 'CLAIMS_MANAGER']
      const hasVetterAccess = allowedRoles.includes(user.role.name)

      console.log('🔐 Vetter Access Check:')
      console.log(`   Required roles: ${allowedRoles.join(', ')}`)
      console.log(`   User role: ${user.role.name}`)
      console.log(`   Has access: ${hasVetterAccess ? '✅ YES' : '❌ NO'}`)
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUserRole()
