import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Seeding Call Centre permissions...')

  // First, get or create the CALL_CENTRE role
  let callCentreRole = await prisma.role.findFirst({
    where: { name: 'CALL_CENTRE' }
  })

  if (!callCentreRole) {
    console.log('  📝 Creating CALL_CENTRE role...')
    callCentreRole = await prisma.role.create({
      data: {
        name: 'CALL_CENTRE',
        description: 'Call Centre Staff'
      }
    })
  }

  const callCentrePermissions = [
    { module: 'dashboard', action: 'view' },
    { module: 'call-centre', action: 'view' },
    { module: 'call-centre', action: 'add' },
    { module: 'call-centre', action: 'edit' },
    { module: 'call-centre', action: 'delete' },
    { module: 'call-centre', action: 'manage_requests' },
    { module: 'call-centre', action: 'verify_codes' },
    { module: 'call-centre', action: 'check_coverage' },
    { module: 'call-centre', action: 'procurement' },
    { module: 'hr', action: 'view' },
    { module: 'hr', action: 'procurement' },
    { module: 'underwriting', action: 'view' },
    { module: 'underwriting', action: 'manage_organizations' },
    { module: 'underwriting', action: 'manage_principals' },
    { module: 'underwriting', action: 'manage_dependents' },
    { module: 'underwriting_coverage', action: 'view' },
    { module: 'underwriting_mobile', action: 'view' },
    { module: 'claims', action: 'view' },
    { module: 'providers', action: 'view' },
    { module: 'reports', action: 'view' },
    { module: 'settings', action: 'view' },
    { module: 'telemedicine', action: 'view' },
  ]

  let created = 0
  let updated = 0

  for (const perm of callCentrePermissions) {
    const existing = await prisma.permission.findFirst({
      where: {
        role_id: callCentreRole.id,
        module: perm.module,
        action: perm.action,
      },
    })

    if (!existing) {
      await prisma.permission.create({
        data: {
          role_id: callCentreRole.id,
          module: perm.module,
          action: perm.action,
          allowed: true,
        },
      })
      created++
      console.log(`  ✅ Created: ${perm.module}.${perm.action}`)
    } else if (!existing.allowed) {
      await prisma.permission.update({
        where: { id: existing.id },
        data: { allowed: true },
      })
      updated++
      console.log(`  ✅ Enabled: ${perm.module}.${perm.action}`)
    }
  }

  console.log(`\n✅ Successfully seeded Call Centre permissions!`)
  console.log(`   Created: ${created}, Enabled: ${updated}`)
}

main()
  .catch((e) => {
    console.error('❌ Error seeding permissions:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
