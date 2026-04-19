import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting package limits migration...')
  
  // First, let's see what columns exist
  const tableInfo = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'package_limits'
    ORDER BY ordinal_position
  `
  
  console.log('Current table structure:')
  console.log(tableInfo)
  
  // Now get all existing data
  const existingLimits = await prisma.$queryRaw`
    SELECT *
    FROM package_limits
  `
  
  console.log('\nExisting package limits data:')
  console.log(JSON.stringify(existingLimits, null, 2))
  console.log(`\nFound ${(existingLimits as any[]).length} existing records`)
  
  if ((existingLimits as any[]).length > 0) {
    console.log('\nExisting data will need to be migrated.')
    console.log('Please review the data above before proceeding with schema changes.')
  } else {
    console.log('\nNo existing data found. Safe to proceed with schema changes.')
  }
}

main()
  .then(() => {
    console.log('\nMigration check complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
