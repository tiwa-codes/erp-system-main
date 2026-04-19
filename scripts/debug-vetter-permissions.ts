import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugVetterPermissions() {
  try {
    console.log('🔍 Debugging Vetter Permissions...\n')
    
    // Get the admin user
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@erp.com' },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: {
          select: {
            name: true
          }
        },
        role_id: true
      }
    })
    
    if (!adminUser) {
      console.log('❌ Admin user not found!')
      return
    }
    
    console.log('👤 Admin User Details:')
    console.log(`   ID: ${adminUser.id}`)
    console.log(`   Email: ${adminUser.email}`)
    console.log(`   Name: ${adminUser.first_name} ${adminUser.last_name}`)
    console.log(`   Role: ${adminUser.role?.name}`)
    console.log(`   Role ID: ${adminUser.role_id}`)
    
    // Check if role matches required permissions
    const requiredRoles = ['SUPER_ADMIN', 'ADMIN', 'CLAIMS_PROCESSOR', 'CLAIMS_MANAGER']
    const hasPermission = requiredRoles.includes(adminUser.role?.name || '')
    
    console.log(`\n🔐 Permission Check:`)
    console.log(`   Required Roles: ${requiredRoles.join(', ')}`)
    console.log(`   User Role: ${adminUser.role?.name}`)
    console.log(`   Has Permission: ${hasPermission ? '✅ YES' : '❌ NO'}`)
    
    // Check for any claims in vetter1 stage
    console.log(`\n📊 Claims in Vetter1 Stage:`)
    const vetter1Claims = await prisma.claim.count({
      where: {
        current_stage: 'vetter1'
      }
    })
    console.log(`   Total: ${vetter1Claims}`)
    
    // Check claims by status in vetter1
    const pendingInVetter1 = await prisma.claim.count({
      where: {
        current_stage: 'vetter1',
        status: 'PENDING'
      }
    })
    console.log(`   PENDING: ${pendingInVetter1}`)
    
    const submittedInVetter1 = await prisma.claim.count({
      where: {
        current_stage: 'vetter1',
        status: 'SUBMITTED'
      }
    })
    console.log(`   SUBMITTED: ${submittedInVetter1}`)
    
    // Test the exact permission check used in the API
    console.log(`\n🧪 Testing API Permission Logic:`)
    const testPermission = ['SUPER_ADMIN', 'ADMIN', 'CLAIMS_PROCESSOR', 'CLAIMS_MANAGER'].includes(adminUser.role?.name || '')
    console.log(`   Result: ${testPermission ? '✅ PASS' : '❌ FAIL'}`)
    
    if (!testPermission) {
      console.log(`\n⚠️  Problem: User role "${adminUser.role?.name}" is not in the allowed list!`)
      console.log(`   This will cause 403 Forbidden errors.`)
    } else {
      console.log(`\n✅ Permission check passes - API should now work correctly`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugVetterPermissions()
