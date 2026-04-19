/**
 * Cleanup Script: Delete Service Types
 * 
 * This script deletes all records from the service_types table as per
 * the new requirement that services should only come from Tariff Plan Management.
 * 
 * ⚠️ WARNING: This will delete all service types. Make sure you have a backup!
 * 
 * Run with: npx ts-node scripts/delete-service-types.ts
 */

import { PrismaClient } from '@prisma/client'
import * as readline from 'readline'

const prisma = new PrismaClient()

async function askForConfirmation(): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })

    return new Promise((resolve) => {
        rl.question(
            '\n⚠️  WARNING: This will delete ALL service types from Settings → Service Type.\n' +
            'Are you sure you want to continue? (yes/no): ',
            (answer) => {
                rl.close()
                resolve(answer.toLowerCase() === 'yes')
            }
        )
    })
}

async function deleteServiceTypes() {
    console.log('🔍 Checking service types...')

    const count = await prisma.serviceType.count()
    console.log(`Found ${count} service types`)

    if (count === 0) {
        console.log('✅ No service types to delete.')
        return
    }

    const confirmed = await askForConfirmation()

    if (!confirmed) {
        console.log('❌ Operation cancelled.')
        return
    }

    console.log('\n🗑️  Deleting service types...')

    // Step 1: Delete all CoveredService records that reference ServiceType
    console.log('Step 1: Deleting CoveredService records...')
    const coveredServicesResult = await prisma.coveredService.deleteMany({})
    console.log(`  ✓ Deleted ${coveredServicesResult.count} covered service records`)

    // Step 2: Delete all TariffPlanService records that reference ServiceType
    console.log('Step 2: Deleting TariffPlanService records...')
    const tariffPlanServicesResult = await prisma.tariffPlanService.deleteMany({})
    console.log(`  ✓ Deleted ${tariffPlanServicesResult.count} tariff plan service records`)

    // Step 3: Now delete the ServiceType records
    console.log('Step 3: Deleting ServiceType records...')
    const result = await prisma.serviceType.deleteMany({})
    console.log(`  ✓ Deleted ${result.count} service types`)

    console.log(`\n✅ Successfully deleted:`)
    console.log(`   - ${coveredServicesResult.count} covered services`)
    console.log(`   - ${tariffPlanServicesResult.count} tariff plan services`)
    console.log(`   - ${result.count} service types`)
    console.log('\nℹ️  Services will now only come from Provider → Tariff Plan Management.')
    console.log('ℹ️  Providers will need to re-add their services through Tariff Plan.')
}

async function main() {
    try {
        await deleteServiceTypes()
    } catch (error) {
        console.error('❌ Deletion failed:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

main()
