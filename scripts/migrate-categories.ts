/**
 * Migration Script: Migrate Category IDs
 * 
 * This script migrates existing tariff plan services from old category IDs
 * to the new non-sequential category ID system.
 * 
 * Run with: npx ts-node scripts/migrate-categories.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Mapping from old category IDs to new category IDs
const categoryMapping: Record<string, { newId: string; newName: string }> = {
    'CON': { newId: '9', newName: 'Specialist Consultation' },
    'LAB': { newId: '15', newName: 'Advanced Lab' },
    'RAD': { newId: '4', newName: 'Advanced Diagnostic Imaging' },
    'DRG': { newId: '24', newName: 'Drugs' },
    'PRC': { newId: '6', newName: 'Surgery' },
    'DEN': { newId: '12', newName: 'Dental Care' },
    'EYE': { newId: '11', newName: 'Optical Care' },
    'PHY': { newId: '5', newName: 'Physiotherapy' },
    'MAT': { newId: '2', newName: 'Caesarian section / Normal Delivery' },
    'PED': { newId: '18', newName: 'Neonate Care' },
    'EMG': { newId: '17', newName: 'ICU' },
    'ADM': { newId: '1', newName: 'Admission' },
    'CNS': { newId: '10', newName: 'Others' },
    'OTH': { newId: '10', newName: 'Others' }
}

async function migrateCategoryIds() {
    console.log('Starting category ID migration...')

    let totalUpdated = 0

    for (const [oldId, { newId, newName }] of Object.entries(categoryMapping)) {
        console.log(`Migrating ${oldId} → ${newId} (${newName})`)

        const result = await prisma.tariffPlanService.updateMany({
            where: { category_id: oldId },
            data: {
                category_id: newId,
                category_name: newName
            }
        })

        console.log(`  Updated ${result.count} services`)
        totalUpdated += result.count
    }

    console.log(`\n✅ Migration complete! Updated ${totalUpdated} services total.`)
}

async function main() {
    try {
        await migrateCategoryIds()
    } catch (error) {
        console.error('❌ Migration failed:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

main()
