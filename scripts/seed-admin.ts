import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create super admin role
  const role = await prisma.role.upsert({
    where: { name: 'Super Admin' },
    update: {},
    create: {
      name: 'Super Admin',
      description: 'Full system access',
      is_system: true,
      is_active: true,
      permissions: [],
    },
  })

  const hashedPassword = await bcrypt.hash('Admin@1234', 12)

  const user = await prisma.user.upsert({
    where: { email: 'admin@aspirage.com' },
    update: {},
    create: {
      email: 'admin@aspirage.com',
      password: hashedPassword,
      first_name: 'Admin',
      last_name: 'User',
      role_id: role.id,
      status: 'ACTIVE',
      email_verified: new Date(),
    },
  })

  console.log('✅ Admin user created:')
  console.log('   Email:    admin@aspirage.com')
  console.log('   Password: Admin@1234')
  console.log('   User ID:', user.id)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
