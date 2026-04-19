/**
 * Script to add generate-approval-code permission to TELEMEDICINE role
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addApprovalCodePermission() {
  console.log('Adding generate-approval-code permission to TELEMEDICINE role...\n')

  try {
    // Find TELEMEDICINE role
    const telemedicineRole = await prisma.role.findFirst({
      where: {
        name: { contains: 'TELEMEDICINE', mode: 'insensitive' }
      }
    })

    if (!telemedicineRole) {
      console.log('❌ TELEMEDICINE role not found!')
      return
    }

    console.log(`✓ Found TELEMEDICINE role: ${telemedicineRole.name} (ID: ${telemedicineRole.id})`)

    // Check if permission already exists
    const existingPermission = await prisma.permission.findFirst({
      where: {
        role_id: telemedicineRole.id,
        module: 'call-centre',
        submodule: 'generate-approval-code'
      }
    })

    if (existingPermission) {
      console.log('⚠️  Permission already exists!')
      console.log(`   - Module: ${existingPermission.module}`)
      console.log(`   - Submodule: ${existingPermission.submodule}`)
      console.log(`   - Action: ${existingPermission.action}`)
      console.log(`   - Allowed: ${existingPermission.allowed}`)
      
      if (!existingPermission.allowed) {
        console.log('\n📝 Enabling the permission...')
        await prisma.permission.update({
          where: { id: existingPermission.id },
          data: { allowed: true }
        })
        console.log('✓ Permission enabled!')
      }
      return
    }

    // Create the permission
    const permission = await prisma.permission.create({
      data: {
        role_id: telemedicineRole.id,
        module: 'call-centre',
        submodule: 'generate-approval-code',
        action: 'add',
        allowed: true
      }
    })

    console.log('✓ Permission added successfully!')
    console.log(`   - ID: ${permission.id}`)
    console.log(`   - Module: ${permission.module}`)
    console.log(`   - Submodule: ${permission.submodule}`)
    console.log(`   - Action: ${permission.action}`)
    console.log(`   - Allowed: ${permission.allowed}`)

    console.log('\n✓ TELEMEDICINE role can now access "Generate Approval Code"')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addApprovalCodePermission()
