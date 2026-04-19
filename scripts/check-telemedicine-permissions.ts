/**
 * Script to check TELEMEDICINE role permissions in database
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkTelemedicinePermissions() {
  console.log('🔍 Checking TELEMEDICINE role permissions...\n')

  try {
    // Find TELEMEDICINE role (any variation)
    const roles = await prisma.role.findMany({
      where: {
        name: { contains: 'TELEMEDICINE', mode: 'insensitive' }
      }
    })

    console.log(`Found ${roles.length} role(s):`)
    roles.forEach(role => {
      console.log(`  - ${role.name} (ID: ${role.id}, Active: ${role.is_active})`)
    })

    if (roles.length === 0) {
      console.log('❌ No TELEMEDICINE role found!')
      return
    }

    for (const role of roles) {
      console.log(`\n📋 Permissions for role: ${role.name}`)
      
      const permissions = await prisma.permission.findMany({
        where: {
          role_id: role.id,
          allowed: true
        },
        orderBy: [
          { module: 'asc' },
          { submodule: 'asc' },
          { action: 'asc' }
        ]
      })

      console.log(`Total permissions: ${permissions.length}\n`)

      // Group by module
      const byModule = permissions.reduce((acc, p) => {
        const key = p.module
        if (!acc[key]) acc[key] = []
        acc[key].push(p)
        return acc
      }, {} as Record<string, typeof permissions>)

      Object.entries(byModule).forEach(([module, perms]) => {
        console.log(`  📦 ${module}:`)
        perms.forEach(p => {
          console.log(`     - ${p.action}${p.submodule ? ` (${p.submodule})` : ''}`)
        })
      })

      // Check specifically for reports
      const reportsPerms = permissions.filter(p => 
        p.module.toLowerCase().includes('report')
      )
      
      console.log(`\n  🔍 Reports permissions: ${reportsPerms.length}`)
      if (reportsPerms.length > 0) {
        reportsPerms.forEach(p => {
          console.log(`     ✓ ${p.module} - ${p.action}${p.submodule ? ` (${p.submodule})` : ''}`)
        })
      } else {
        console.log('     ❌ No reports permissions found!')
      }
    }

    // Check users with this role
    console.log(`\n👥 Users with TELEMEDICINE role:`)
    for (const role of roles) {
      const users = await prisma.user.findMany({
        where: { role_id: role.id },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          role: { select: { name: true } }
        }
      })
      console.log(`  ${role.name}: ${users.length} user(s)`)
      users.forEach(u => {
        console.log(`    - ${u.first_name} ${u.last_name} (${u.email})`)
      })
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkTelemedicinePermissions()
  .catch(console.error)
  .finally(() => process.exit(0))

