import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testBandValidation() {
  console.log('=== TESTING BAND VALIDATION FIX ===\n')
  
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
  
  // Check PlanBand records for Basic Health Plan + Nyanya
  const planBands = await prisma.planBand.findMany({
    where: {
      plan_id: fatima.plan_id,
      provider_id: nyanya.id,
      status: 'ACTIVE'
    },
    include: {
      plan: true,
      provider: true
    }
  })
  
  console.log('\n📋 PLANBAND RECORDS:')
  console.log('   Count:', planBands.length)
  planBands.forEach((pb, index) => {
    console.log(`   ${index + 1}. Plan: ${pb.plan.name} | Provider: ${pb.provider.facility_name} | Band: ${pb.band_type}`)
  })
  
  // Simulate the band validation logic
  const enrolleeBands = fatima.plan?.assigned_bands && fatima.plan?.assigned_bands.length > 0 
    ? fatima.plan?.assigned_bands 
    : (fatima.plan?.band_type ? [fatima.plan?.band_type] : ["Band A"])
  
  console.log('\n🔍 BAND VALIDATION SIMULATION:')
  console.log('   Enrollee Bands:', enrolleeBands)
  
  if (planBands.length === 0) {
    console.log('   ❌ RESULT: Provider cannot serve this plan - no PlanBand records')
    console.log('   ✅ This should now be REJECTED (fixed!)')
  } else {
    const providerBands = planBands.map(pb => pb.band_type)
    console.log('   Provider Bands for this plan:', providerBands)
    
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
    
    const normalizeBand = (band) => {
      const normalized = band.toLowerCase().trim()
      if (normalized === 'a' || normalized === 'band a') return 'Band A'
      if (normalized === 'b' || normalized === 'band b') return 'Band B'
      if (normalized === 'c' || normalized === 'band c') return 'Band C'
      return band
    }
    
    const isBandMatch = enrolleeBands.some(enrolleeBand => {
      const accessibleBands = getAccessibleBands(enrolleeBand)
      console.log(`   Enrollee band "${enrolleeBand}" can access:`, accessibleBands)
      
      const hasMatch = accessibleBands.some(accessibleBand => {
        const normalizedAccessible = normalizeBand(accessibleBand)
        const providerMatch = providerBands.some(providerBand => {
          const normalizedProvider = normalizeBand(providerBand)
          const isMatch = normalizedProvider === normalizedAccessible
          console.log(`   Comparing "${providerBand}" (${normalizedProvider}) with "${accessibleBand}" (${normalizedAccessible}): ${isMatch}`)
          return isMatch
        })
        return providerMatch
      })
      
      console.log(`   Enrollee band "${enrolleeBand}" has match:`, hasMatch)
      return hasMatch
    })
    
    console.log('\n🎯 FINAL RESULT:')
    if (isBandMatch) {
      console.log('   ✅ ALLOWED - Band validation passed')
    } else {
      console.log('   ❌ REJECTED - Band validation failed')
    }
  }
  
  await prisma.$disconnect()
}

testBandValidation().catch(console.error)
