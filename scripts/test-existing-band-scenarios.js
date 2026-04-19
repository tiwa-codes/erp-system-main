// Test script to find existing data and test band scenarios
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testExistingBandScenarios() {
  console.log('🧪 Testing Band Verification with Existing Data...\n')

  try {
    // Find existing plans with different band types
    const plans = await prisma.plan.findMany({
      select: {
        id: true,
        name: true,
        band_type: true,
        assigned_bands: true,
        status: true
      },
      where: {
        status: 'ACTIVE'
      },
      take: 10
    })
    
    console.log('📋 Found plans:')
    plans.forEach((plan, index) => {
      console.log(`${index + 1}. ${plan.name} - Band Type: ${plan.band_type} - Assigned Bands: ${JSON.stringify(plan.assigned_bands)}`)
    })
    console.log('')
    
    // Find existing enrollees with different bands
    const enrollees = await prisma.principalAccount.findMany({
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            band_type: true,
            assigned_bands: true
          }
        }
      },
      where: {
        status: 'ACTIVE',
        plan: {
          status: 'ACTIVE'
        }
      },
      take: 10
    })
    
    console.log('👥 Found enrollees:')
    enrollees.forEach((enrollee, index) => {
      const bands = enrollee.plan?.assigned_bands || [enrollee.plan?.band_type].filter(Boolean)
      console.log(`${index + 1}. ${enrollee.enrollee_id} (${enrollee.first_name} ${enrollee.last_name}) - Plan: ${enrollee.plan?.name} - Bands: ${JSON.stringify(bands)}`)
    })
    console.log('')
    
    // Find existing providers
    const providers = await prisma.provider.findMany({
      select: {
        id: true,
        facility_name: true,
        facility_type: true,
        status: true
      },
      where: {
        status: 'APPROVED'
      },
      take: 5
    })
    
    console.log('🏥 Found providers:')
    providers.forEach((provider, index) => {
      console.log(`${index + 1}. ${provider.facility_name} (${provider.facility_type})`)
    })
    console.log('')
    
    // Find PlanBand relationships
    const planBands = await prisma.planBand.findMany({
      include: {
        plan: {
          select: { name: true, assigned_bands: true }
        },
        provider: {
          select: { facility_name: true }
        }
      },
      where: {
        status: 'ACTIVE'
      },
      take: 10
    })
    
    console.log('🔗 Found Plan-Provider Band relationships:')
    planBands.forEach((pb, index) => {
      console.log(`${index + 1}. ${pb.plan.name} → ${pb.provider.facility_name} (Band: ${pb.band_type})`)
    })
    console.log('')
    
    // Test the band validation logic with existing data
    if (enrollees.length > 0 && providers.length > 0) {
      console.log('🧪 Testing Band Logic with Existing Data:')
      console.log('='.repeat(50))
      
      // Replicate the band validation logic from the API
      function getAccessibleBands(enrolleeBand) {
        const band = enrolleeBand.toLowerCase().trim()
        console.log('Processing enrollee band:', enrolleeBand, 'normalized to:', band)
        
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
            console.log('Unknown band format:', band, 'returning original:', enrolleeBand)
            return [enrolleeBand]
        }
      }
      
      function normalizeBand(band) {
        const normalized = band.toLowerCase().trim()
        if (normalized === 'a' || normalized === 'band a') return 'Band A'
        if (normalized === 'b' || normalized === 'band b') return 'Band B'
        if (normalized === 'c' || normalized === 'band c') return 'Band C'
        return band
      }
      
      // Test each enrollee against each provider
      for (let i = 0; i < Math.min(3, enrollees.length); i++) {
        const enrollee = enrollees[i]
        const enrolleeBands = enrollee.plan?.assigned_bands && enrollee.plan.assigned_bands.length > 0 
          ? enrollee.plan.assigned_bands.map(b => `Band ${b.toUpperCase()}`)
          : (enrollee.plan?.band_type ? [enrollee.plan.band_type] : ["Band A"])
        
        console.log(`\\n👤 ${enrollee.enrollee_id} - Bands: ${enrolleeBands.join(', ')}`)
        
        for (let j = 0; j < Math.min(2, providers.length); j++) {
          const provider = providers[j]
          
          // Find PlanBand records for this enrollee's plan and this provider
          const planBandsForCombo = await prisma.planBand.findMany({
            where: {
              plan_id: enrollee.plan_id,
              provider_id: provider.id,
              status: 'ACTIVE'
            }
          })
          
          if (planBandsForCombo.length === 0) {
            console.log(`  ⚠️  No PlanBand records for ${provider.facility_name} - Provider not available`)
            continue
          }
          
          const providerBands = planBandsForCombo.map(pb => pb.band_type)
          console.log(`  🏥 ${provider.facility_name} - Provider Bands: ${providerBands.join(', ')}`)
          
          // Test band validation
          const isBandMatch = enrolleeBands.some(enrolleeBand => {
            const accessibleBands = getAccessibleBands(enrolleeBand)
            console.log(`    Enrollee band "${enrolleeBand}" can access: ${accessibleBands.join(', ')}`)
            
            return accessibleBands.some(accessibleBand => {
              const normalizedAccessible = normalizeBand(accessibleBand)
              return providerBands.some(providerBand => {
                const normalizedProvider = normalizeBand(providerBand)
                const isMatch = normalizedProvider === normalizedAccessible
                console.log(`    Comparing "${providerBand}" with "${accessibleBand}": ${isMatch}`)
                return isMatch
              })
            })
          })
          
          console.log(`    Result: ${isBandMatch ? '✅ ALLOWED' : '❌ DENIED'}`)
        }
      }
    }
    
    console.log('\\n🎯 Testing Complete!')
    console.log('This shows how the band validation logic works with your actual data.')
    console.log('Look for cases where you expect DENIED but see ALLOWED, or vice versa.')
    
  } catch (error) {
    console.error('❌ Error during test:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testExistingBandScenarios().catch(console.error)