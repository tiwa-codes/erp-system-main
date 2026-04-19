import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkSpecificPlanBand() {
  console.log('=== CHECKING SPECIFIC PLANBAND RECORD ===\n')
  
  // Check the specific PlanBand record for Basic Health Plan and Nyanya
  const planBand = await prisma.planBand.findFirst({
    where: {
      plan: { name: 'Basic Health Plan' },
      provider: { facility_name: { contains: 'Nyanya' } }
    },
    include: {
      plan: true,
      provider: true
    }
  })
  
  if (planBand) {
    console.log('✅ PLANBAND RECORD FOUND:')
    console.log('   Plan:', planBand.plan.name)
    console.log('   Provider:', planBand.provider.facility_name)
    console.log('   Band Type:', planBand.band_type)
    console.log('   Status:', planBand.status)
  } else {
    console.log('❌ NO PLANBAND RECORD FOUND for Basic Health Plan + Nyanya')
  }
  
  // Check Fatima's exact plan
  const fatima = await prisma.principalAccount.findFirst({
    where: { first_name: { contains: 'Fatima' } },
    include: { plan: true }
  })
  
  if (fatima) {
    console.log('\n👤 FATIMA\'S PLAN DETAILS:')
    console.log('   Plan ID:', fatima.plan_id)
    console.log('   Plan Name:', fatima.plan?.name)
    console.log('   Assigned Bands:', fatima.plan?.assigned_bands)
    console.log('   Band Type:', fatima.plan?.band_type)
  }
  
  await prisma.$disconnect()
}

checkSpecificPlanBand().catch(console.error)
