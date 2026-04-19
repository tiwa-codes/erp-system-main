/**
 * Script to add ONLY the missing modules to ADMIN role
 * This avoids duplicates and only adds what's missing
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Only the missing permissions for ADMIN role
const missingPermissions = [
    // special-risk module
    { module: "special-risk", action: "view" },
    { module: "special-risk", action: "add" },
    { module: "special-risk", action: "edit" },
    { module: "special-risk", action: "approve" },
    { module: "special-risk", action: "manage_providers" },
    { module: "special-risk", action: "manage_memos" },

    // legal module
    { module: "legal", action: "view" },
    { module: "legal", action: "manage_msa" },
    { module: "legal", action: "send_msa" },
    { module: "legal", action: "manage_memos" },

    // sales module
    { module: "sales", action: "view" },
    { module: "sales", action: "view_all" },
    { module: "sales", action: "add" },
    { module: "sales", action: "edit" },
    { module: "sales", action: "delete" },
    { module: "sales", action: "submit" },
    { module: "sales", action: "vet" },
    { module: "sales", action: "approve" },
    { module: "sales", action: "upload" },
    { module: "sales", action: "manage_memos" },
]

async function addMissingPermissions() {
    console.log('🔄 Adding missing permissions to ADMIN role...\\n')

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

        let created = 0
        let skipped = 0

        for (const perm of missingPermissions) {
            // Check if permission already exists
            const existing = await prisma.permission.findFirst({
                where: {
                    role_id: adminRole.id,
                    module: perm.module,
                    action: perm.action,
                    submodule: null,
                }
            })

            if (existing) {
                console.log(`  ⏭️  Skipped: ${perm.module}:${perm.action} (already exists)`)
                skipped++
            } else {
                // Create new permission
                await prisma.permission.create({
                    data: {
                        role_id: adminRole.id,
                        module: perm.module,
                        action: perm.action,
                        submodule: null,
                        allowed: true
                    }
                })
                console.log(`  ✅ Created: ${perm.module}:${perm.action}`)
                created++
            }
        }

        console.log(`\\n📊 Summary:`)
        console.log(`  Created: ${created}`)
        console.log(`  Skipped: ${skipped}`)
        console.log(`  Total: ${missingPermissions.length}`)

        console.log('\\n✅ Done!')

    } catch (error) {
        console.error('❌ Error:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

addMissingPermissions()
