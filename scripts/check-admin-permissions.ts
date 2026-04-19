/**
 * Quick script to check what permissions are actually in the database for ADMIN role
 * This will help us identify any naming mismatches
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAdminPermissions() {
    console.log('🔍 Checking ADMIN role permissions in database...\\n')

    try {
        // Find ADMIN role
        const adminRole = await prisma.role.findFirst({
            where: { name: 'ADMIN' }
        })

        if (!adminRole) {
            console.log('❌ ADMIN role not found!')
            return
        }

        console.log(`✅ Found ADMIN role (ID: ${adminRole.id})\\n`)

        // Get all permissions for ADMIN
        const permissions = await prisma.permission.findMany({
            where: {
                role_id: adminRole.id,
                allowed: true
            },
            orderBy: {
                module: 'asc'
            }
        })

        console.log(`📊 Total permissions: ${permissions.length}\\n`)

        // Group by module
        const byModule: Record<string, string[]> = {}
        permissions.forEach(p => {
            if (!byModule[p.module]) {
                byModule[p.module] = []
            }
            byModule[p.module].push(p.action)
        })

        // Display grouped permissions
        console.log('📋 Permissions by module:\\n')
        Object.keys(byModule).sort().forEach(module => {
            console.log(`  ${module}:`)
            console.log(`    Actions: ${byModule[module].join(', ')}`)
            console.log(`    Count: ${byModule[module].length}\\n`)
        })

        // Check for specific modules we added
        const modulesToCheck = [
            'special-risk',
            'legal',
            'sales',
            'operation-desk',
            'underwriting',
            'call-centre',
            'provider',
            'telemedicine'
        ]

        console.log('\\n🔎 Checking specific modules:\\n')
        modulesToCheck.forEach(mod => {
            const hasModule = byModule[mod]
            if (hasModule) {
                console.log(`  ✅ ${mod}: ${hasModule.length} permissions`)
                if (hasModule.includes('manage_memos')) {
                    console.log(`     ✓ Has manage_memos`)
                }
            } else {
                console.log(`  ❌ ${mod}: NOT FOUND`)
            }
        })

    } catch (error) {
        console.error('❌ Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

checkAdminPermissions()
