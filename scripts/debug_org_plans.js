
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const searchTerm = 'Taj' // specific to user report
  
  console.log(`Searching for organizations matching "${searchTerm}"...`)

  const orgs = await prisma.organization.findMany({
    where: {
      name: {
        contains: searchTerm,
        mode: 'insensitive'
      }
    },
    include: {
      organization_plans: true,
      plans: true // This is the direct relation
    }
  })

  console.log(`Found ${orgs.length} organizations.`)

  for (const org of orgs) {
    console.log(`\nOrganization: ${org.name} (${org.id})`)
    console.log(`- Direct Plans (Plan.organization_id): ${org.plans.length}`)
    org.plans.forEach(p => console.log(`  - [${p.id}] ${p.name} (Status: ${p.status})`))
    
    console.log(`- Linked Plans (OrganizationPlan): ${org.organization_plans.length}`)
    org.organization_plans.forEach(op => console.log(`  - [${op.plan_id}] (Default: ${op.is_default})`))

    const directPlanIds = org.plans.map(p => p.id)
    const linkedPlanIds = org.organization_plans.map(op => op.plan_id)

    const missingLinks = directPlanIds.filter(id => !linkedPlanIds.includes(id))
    
    if (missingLinks.length > 0) {
      console.log(`⚠️ MISMATCH DETECTED! ${missingLinks.length} plans are directly linked but missing from OrganizationPlan table.`)
      console.log('Missing IDs:', missingLinks)
    } else {
      console.log('✅ No mismatch found (all direct plans have links).')
    }
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
