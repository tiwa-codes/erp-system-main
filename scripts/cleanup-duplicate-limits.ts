import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Cleaning up duplicate package limits...')
  
  // Get all limits
  const limits = await prisma.$queryRaw<any[]>`
    SELECT * FROM package_limits ORDER BY created_at ASC
  `
  
  console.log('Current limits:')
  limits.forEach((limit, index) => {
    console.log(`${index + 1}. ID: ${limit.id}, Plan: ${limit.plan_id}, Category: ${limit.category}, Amount: ${limit.amount}, Created: ${limit.created_at}`)
  })
  
  // Keep the one with higher amount (50000), delete the one with 1000
  const idToDelete = 'cmgdy1ifw06k19f18rqbezoxg' // The one with 1000
  
  console.log(`\nDeleting limit with ID: ${idToDelete}`)
  await prisma.$executeRaw`DELETE FROM package_limits WHERE id = ${idToDelete}`
  
  console.log('Deleted successfully!')
  
  // Verify
  const remaining = await prisma.$queryRaw<any[]>`SELECT * FROM package_limits`
  console.log('\nRemaining limits:')
  remaining.forEach((limit, index) => {
    console.log(`${index + 1}. ID: ${limit.id}, Plan: ${limit.plan_id}, Category: ${limit.category}, Amount: ${limit.amount}`)
  })
}

main()
  .then(() => {
    console.log('\nCleanup complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
