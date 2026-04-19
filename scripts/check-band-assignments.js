import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkBands() {
  console.log('=== CHECKING BAND ASSIGNMENTS ===\n')
  
  // Check Fatima Yusuf's plan and bands
  const fatima = await prisma.principalAccount.findFirst({
    where: { first_name: { contains: 'Fatima' } },
    include: { plan: true }
  })
  
  if (fatima) {
    console.log('👤 FATIMA YUSUF:')
    console.log('   Name:', fatima.first_name, fatima.last_name)
    console.log('   Plan:', fatima.plan?.name)
    console.log('   Plan Bands:', fatima.plan?.assigned_bands)
    console.log('   Plan Band Type:', fatima.plan?.band_type)
  }
  
  // Check Nyanya General Hospital
  const nyanya = await prisma.provider.findFirst({
    where: { facility_name: { contains: 'Nyanya' } }
  })
  
  if (nyanya) {
    console.log('\n🏥 NYANYA GENERAL HOSPITAL:')
    console.log('   Name:', nyanya.facility_name)
    console.log('   ID:', nyanya.id)
    
    // Check PlanBand records for this provider
    const planBands = await prisma.planBand.findMany({
      where: { provider_id: nyanya.id },
      include: { plan: true }
    })
    
    console.log('   PlanBand Records:', planBands.length)
    planBands.forEach(pb => {
      console.log('     - Plan:', pb.plan.name, 'Band:', pb.band_type)
    })
  }
  
  await prisma.$disconnect()
}

checkBands().catch(console.error)
