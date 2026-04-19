/**
 * Migration Script: Migrate Service Types
 * 
 * This script updates existing service_type values from the old system (2 = Secondary)
 * to the new system (NULL = Secondary, 1 = Primary).
 * 
 * Run with: npx ts-node scripts/migrate-service-types.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateServiceTypes() {
    console.log('Starting service type migration...')

    // Update all services with service_type = 2 to NULL (Secondary)
    const result = await prisma.tariffPlanService.updateMany({
        where: { service_type: 2 },
        data: { service_type: null }
    })

    console.log(`✅ Updated ${result.count} services from type 2 to NULL (Secondary)`)

    // Count services with type 1 (Primary)
    const primaryCount = await prisma.tariffPlanService.count({
        where: { service_type: 1 }
    })

    console.log(`ℹ️  Found ${primaryCount} Primary services (type = 1)`)

    // Count services with NULL type (Secondary)
    const secondaryCount = await prisma.tariffPlanService.count({
        where: { service_type: null }
    })

    console.log(`ℹ️  Found ${secondaryCount} Secondary services (type = NULL)`)

    console.log('\n✅ Migration complete!')
}

async function main() {
    try {
        await migrateServiceTypes()
    } catch (error) {
        console.error('❌ Migration failed:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

main()
