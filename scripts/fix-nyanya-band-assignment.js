import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixNyanyaBandAssignment() {
  console.log('=== FIXING NYANYA BAND ASSIGNMENT ===\n')
  
  // Find Fatima's plan
  const fatima = await prisma.principalAccount.findFirst({
    where: { first_name: { contains: 'Fatima' } },
    include: { plan: true }
  })
  
  // Find Nyanya
  const nyanya = await prisma.provider.findFirst({
    where: { facility_name: { contains: 'Nyanya' } }
  })
  
  if (!fatima || !nyanya) {
    console.log('❌ Fatima or Nyanya not found')
    return
  }
  
  console.log('👤 FATIMA:')
  console.log('   Name:', fatima.first_name, fatima.last_name)
  console.log('   Plan:', fatima.plan?.name)
  console.log('   Band:', fatima.plan?.assigned_bands)
  
  console.log('\n🏥 NYANYA:')
  console.log('   Name:', nyanya.facility_name)
  
  // Find the current PlanBand record
  const currentPlanBand = await prisma.planBand.findFirst({
    where: {
      plan_id: fatima.plan_id,
      provider_id: nyanya.id
    }
  })
  
  if (!currentPlanBand) {
    console.log('❌ No PlanBand record found')
    return
  }
  
  console.log('\n📋 CURRENT PLANBAND RECORD:')
  console.log('   ID:', currentPlanBand.id)
  console.log('   Current Band:', currentPlanBand.band_type)
  console.log('   Status:', currentPlanBand.status)
  
  // Update from Band C to Band A
  const updatedPlanBand = await prisma.planBand.update({
    where: { id: currentPlanBand.id },
    data: { band_type: 'Band A' }
  })
  
  console.log('\n✅ PLANBAND RECORD UPDATED:')
  console.log('   New Band:', updatedPlanBand.band_type)
  console.log('   Status:', updatedPlanBand.status)
  
  // Test the band validation
  console.log('\n🔍 BAND VALIDATION TEST:')
  const enrolleeBands = fatima.plan?.assigned_bands && fatima.plan?.assigned_bands.length > 0 
    ? fatima.plan?.assigned_bands 
    : (fatima.plan?.band_type ? [fatima.plan?.band_type] : ["Band A"])
  
  console.log('   Enrollee Bands:', enrolleeBands)
  console.log('   Provider Band:', updatedPlanBand.band_type)
  
  // Check hierarchical access
  const getAccessibleBands = (enrolleeBand) => {
    const band = enrolleeBand.toLowerCase().trim()
    switch (band) {
      case 'band a':
      case 'a':
        return ['Band A', 'Band B', 'Band C']
      case 'band b':
      case 'b':
        return ['Band B', 'Band C']
      case 'band c':
      case 'c':
        return ['Band C']
      default:
        return [enrolleeBand]
    }
  }
  
  const accessibleBands = getAccessibleBands(enrolleeBands[0])
  console.log(`   Enrollee band "${enrolleeBands[0]}" can access:`, accessibleBands)
  
  const canAccess = accessibleBands.includes(updatedPlanBand.band_type)
  console.log(`   Can access "${updatedPlanBand.band_type}":`, canAccess)
  
  console.log('\n🎯 FINAL RESULT:')
  if (canAccess) {
    console.log('   ✅ ALLOWED - This is still wrong!')
  } else {
    console.log('   ❌ REJECTED - This is CORRECT!')
    console.log('   🎉 Band C cannot access Band A - Fixed!')
  }
  
  await prisma.$disconnect()
}

fixNyanyaBandAssignment().catch(console.error)
