const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function migrateOrganizationPlans() {
  try {
    console.log('Starting migration of organization-plan relationships...')
    
    // Get all organizations
    const organizations = await prisma.organization.findMany({
      include: {
        principal_accounts: {
          select: {
            id: true,
            plan_id: true
          }
        }
      }
    })
    
    console.log(`Found ${organizations.length} organizations to migrate`)
    
    for (const org of organizations) {
      console.log(`Processing organization: ${org.name}`)
      
      // Get unique plan IDs from principal accounts
      const planIds = [...new Set(
        org.principal_accounts
          .filter(pa => pa.plan_id)
          .map(pa => pa.plan_id)
      )]
      
      if (planIds.length === 0) {
        console.log(`  No plans found for organization ${org.name}, skipping...`)
        continue
      }
      
      console.log(`  Found plans: ${planIds.join(', ')}`)
      
      // Create organization plan relationships
      for (let i = 0; i < planIds.length; i++) {
        const planId = planIds[i]
        
        // Check if relationship already exists
        const existing = await prisma.organizationPlan.findFirst({
          where: {
            organization_id: org.id,
            plan_id: planId
          }
        })
        
        if (existing) {
          console.log(`    Relationship already exists for plan ${planId}`)
          continue
        }
        
        // Create the relationship
        await prisma.organizationPlan.create({
          data: {
            organization_id: org.id,
            plan_id: planId,
            is_default: i === 0 // First plan is default
          }
        })
        
        console.log(`    Created relationship for plan ${planId} (default: ${i === 0})`)
      }
    }
    
    console.log('Migration completed successfully!')
    
    // Verify the migration
    const totalRelationships = await prisma.organizationPlan.count()
    console.log(`Total organization-plan relationships created: ${totalRelationships}`)
    
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the migration
migrateOrganizationPlans()
  .then(() => {
    console.log('Migration script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration script failed:', error)
    process.exit(1)
  })
