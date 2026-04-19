import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkProviderBandIssue() {
  console.log('=== CHECKING PROVIDER BAND ISSUE ===\n')
  
  // Find Fatima Yusuf
  const fatima = await prisma.principalAccount.findFirst({
    where: { first_name: { contains: 'Fatima' } },
    include: { plan: true }
  })
  
  if (!fatima) {
    console.log('❌ Fatima not found')
    return
  }
  
  console.log('👤 FATIMA YUSUF:')
  console.log('   Name:', fatima.first_name, fatima.last_name)
  console.log('   Plan:', fatima.plan?.name)
  console.log('   Plan ID:', fatima.plan_id)
  console.log('   Assigned Bands:', fatima.plan?.assigned_bands)
  console.log('   Band Type:', fatima.plan?.band_type)
  
  // Find Nyanya General Hospital
  const nyanya = await prisma.provider.findFirst({
    where: { facility_name: { contains: 'Nyanya' } }
  })
  
  if (!nyanya) {
    console.log('❌ Nyanya General Hospital not found')
    return
  }
  
  console.log('\n🏥 NYANYA GENERAL HOSPITAL:')
  console.log('   Name:', nyanya.facility_name)
  console.log('   ID:', nyanya.id)
  
  // Check ALL PlanBand records for Nyanya
  const allNyanyaBands = await prisma.planBand.findMany({
    where: { provider_id: nyanya.id },
    include: { plan: true }
  })
  
  console.log('\n📋 ALL NYANYA PLANBAND RECORDS:')
  allNyanyaBands.forEach((pb, index) => {
    console.log(`   ${index + 1}. Plan: ${pb.plan.name} | Band: ${pb.band_type} | Status: ${pb.status}`)
  })
  
  // Check specifically for Basic Health Plan + Nyanya
  const basicPlanBand = await prisma.planBand.findFirst({
    where: {
      plan_id: fatima.plan_id,
      provider_id: nyanya.id,
      status: 'ACTIVE'
    },
    include: { plan: true }
  })
  
  console.log('\n🎯 SPECIFIC PLANBAND FOR BASIC HEALTH PLAN + NYANYA:')
  if (basicPlanBand) {
    console.log('   ✅ FOUND:')
    console.log('   Plan:', basicPlanBand.plan.name)
    console.log('   Provider:', nyanya.facility_name)
    console.log('   Band:', basicPlanBand.band_type)
    console.log('   Status:', basicPlanBand.status)
    
    console.log('\n🔍 BAND VALIDATION SIMULATION:')
    const enrolleeBands = fatima.plan?.assigned_bands && fatima.plan?.assigned_bands.length > 0 
      ? fatima.plan?.assigned_bands 
      : (fatima.plan?.band_type ? [fatima.plan?.band_type] : ["Band A"])
    
    console.log('   Enrollee Bands:', enrolleeBands)
    console.log('   Provider Band for this plan:', basicPlanBand.band_type)
    
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
    
    const canAccess = accessibleBands.includes(basicPlanBand.band_type)
    console.log(`   Can access "${basicPlanBand.band_type}":`, canAccess)
    
    console.log('\n🎯 RESULT:')
    if (canAccess) {
      console.log('   ✅ ALLOWED - This is WRONG!')
      console.log('   ❌ Band C should NOT access Band A')
    } else {
      console.log('   ❌ REJECTED - This is CORRECT!')
    }
    
  } else {
    console.log('   ❌ NOT FOUND - No PlanBand record for Basic Health Plan + Nyanya')
    console.log('   This should trigger the "provider not assigned to plan" error')
  }
  
  await prisma.$disconnect()
}

checkProviderBandIssue().catch(console.error)
