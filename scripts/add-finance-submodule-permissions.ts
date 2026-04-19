import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addFinanceSubmodulePermissions() {
    try {
        console.log('Starting to add Finance submodule permissions...')

        // Find the Finance Manager role (or Finance Officer if that's what it's called)
        const financeRole = await prisma.role.findFirst({
            where: {
                OR: [
                    { name: { contains: 'FINANCE', mode: 'insensitive' } },
                    { name: { contains: 'Finance', mode: 'insensitive' } }
                ]
            }
        })

        if (!financeRole) {
            console.error('❌ Finance role not found in the database')
            console.log('Available roles:')
            const allRoles = await prisma.role.findMany()
            allRoles.forEach(role => console.log(`  - ${role.name}`))
            return
        }

        console.log(`✅ Found role: ${financeRole.name} (ID: ${financeRole.id})`)

        // Define all finance submodules that should be accessible
        const financeSubmodules = [
            { submodule: 'chart-of-accounts', action: 'view' },
            { submodule: 'chart-of-accounts', action: 'add' },
            { submodule: 'chart-of-accounts', action: 'edit' },
            { submodule: 'chart-of-accounts', action: 'delete' },

            { submodule: 'general-ledger', action: 'view' },
            { submodule: 'general-ledger', action: 'add' },
            { submodule: 'general-ledger', action: 'edit' },

            { submodule: 'general-ledger-summary', action: 'view' },

            { submodule: 'journal-entries', action: 'view' },
            { submodule: 'journal-entries', action: 'add' },
            { submodule: 'journal-entries', action: 'edit' },
            { submodule: 'journal-entries', action: 'delete' },

            { submodule: 'trial-balance', action: 'view' },

            { submodule: 'profit-loss', action: 'view' },

            { submodule: 'balance-sheet', action: 'view' },

            { submodule: 'financial-transactions', action: 'view' },
            { submodule: 'financial-transactions', action: 'add' },
            { submodule: 'financial-transactions', action: 'edit' },

            { submodule: 'claims-settlement', action: 'view' },
            { submodule: 'claims-settlement', action: 'add' },
            { submodule: 'claims-settlement', action: 'edit' },
            { submodule: 'claims-settlement', action: 'approve' },

            { submodule: 'memos', action: 'view' },
            { submodule: 'memos', action: 'add' },
            { submodule: 'memos', action: 'edit' },

            { submodule: 'procurement', action: 'view' },
            { submodule: 'procurement', action: 'add' },
            { submodule: 'procurement', action: 'edit' },

            { submodule: 'leave', action: 'view' },
            { submodule: 'leave', action: 'add' },
            { submodule: 'leave', action: 'edit' },
        ]

        console.log(`\nAdding ${financeSubmodules.length} finance submodule permissions...`)

        // Add each submodule permission
        let added = 0
        let skipped = 0

        for (const { submodule, action } of financeSubmodules) {
            try {
                await prisma.permission.create({
                    data: {
                        role_id: financeRole.id,
                        module: 'finance',
                        submodule: submodule,
                        action: action,
                        allowed: true
                    }
                })
                console.log(`  ✅ Added: finance -> ${submodule} -> ${action}`)
                added++
            } catch (error: any) {
                if (error.code === 'P2002') {
                    // Permission already exists
                    console.log(`  ⏭️  Skipped (exists): finance -> ${submodule} -> ${action}`)
                    skipped++
                } else {
                    console.error(`  ❌ Error adding finance -> ${submodule} -> ${action}:`, error.message)
                }
            }
        }

        console.log(`\n✅ Completed!`)
        console.log(`   Added: ${added} permissions`)
        console.log(`   Skipped: ${skipped} permissions (already existed)`)
        console.log(`\n📝 Finance Manager role (${financeRole.name}) now has access to all finance submodules`)
        console.log(`   Users with this role should now see all finance submodules in the sidebar`)

    } catch (error) {
        console.error('❌ Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

addFinanceSubmodulePermissions()
