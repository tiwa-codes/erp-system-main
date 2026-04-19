
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const orgName = 'Taj Bank'
  
  console.log(`1. Finding Organization "${orgName}"...`)
  const org = await prisma.organization.findFirst({
    where: { name: { contains: 'Taj', mode: 'insensitive' } }
  })

  if (!org) {
    console.log('❌ Organization not found.')
    return
  }
  console.log(`✅ Found Org: ${org.name} (${org.id})`)

  console.log('\n2. checking OrganizationPlan table...')
  const orgPlans = await prisma.organizationPlan.findMany({
    where: { organization_id: org.id },
    include: { plan: true }
  })
  console.log(`Found ${orgPlans.length} records in OrganizationPlan.`)
  orgPlans.forEach(op => console.log(`   - Plan: ${op.plan.name} (${op.plan_id})`))

  console.log('\n3. Checking Plan table for organization_id match...')
  const directPlans = await prisma.plan.findMany({
    where: { organization_id: org.id }
  })
  console.log(`Found ${directPlans.length} plans with organization_id = ${org.id}`)
  directPlans.forEach(p => console.log(`   - Plan: ${p.name} (${p.id})`))

  console.log('\n4. Checking Plan table for "Taj" in name...')
  const namedPlans = await prisma.plan.findMany({
    where: { name: { contains: 'Taj', mode: 'insensitive' } }
  })
  console.log(`Found ${namedPlans.length} plans with "Taj" in name.`)
  namedPlans.forEach(p => console.log(`   - Plan: ${p.name} (${p.id}) [OrgId: ${p.organization_id}]`))

}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
