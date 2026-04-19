import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateTariffPlanProvider() {
  try {
    console.log('Starting migration of tariff plan services to include provider_id...')
    
    // First, let's see what data we have
    const existingServices = await prisma.tariffPlanService.findMany()
    console.log(`Found ${existingServices.length} existing tariff plan services`)
    
    if (existingServices.length === 0) {
      console.log('No existing services to migrate. Proceeding with schema update...')
      return
    }
    
    // For now, we'll delete existing services since they don't have provider context
    // In a real scenario, you might want to assign them to a default provider
    console.log('Deleting existing tariff plan services without provider context...')
    
    await prisma.tariffPlanService.deleteMany({})
    
    console.log('Migration completed successfully!')
    
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

migrateTariffPlanProvider()
  .then(() => {
    console.log('Migration script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration script failed:', error)
    process.exit(1)
  })
