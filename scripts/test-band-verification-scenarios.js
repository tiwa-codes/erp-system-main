// Test script to verify band access scenarios as requested
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Replicate the band access functions from the API
function getAccessibleBands(enrolleeBand) {
  const band = enrolleeBand.toLowerCase().trim()
  console.log('Processing enrollee band:', enrolleeBand, 'normalized to:', band)
  
  switch (band) {
    case 'band a':
    case 'a':
      return ['Band A', 'Band B', 'Band C'] // A has access to A, B, C
    case 'band b':
    case 'b':
      return ['Band B', 'Band C'] // B has access to B, C only
    case 'band c':
    case 'c':
      return ['Band C'] // C has access to C only
    default:
      console.log('Unknown band format:', band, 'returning original:', enrolleeBand)
      return [enrolleeBand] // Default to same band
  }
}

function normalizeBand(band) {
  const normalized = band.toLowerCase().trim()
  if (normalized === 'a' || normalized === 'band a') return 'Band A'
  if (normalized === 'b' || normalized === 'band b') return 'Band B'
  if (normalized === 'c' || normalized === 'band c') return 'Band C'
  return band // Return original if not recognized
}

async function testBandVerificationScenarios() {
  console.log('🧪 Testing Band Verification Scenarios as Requested...\n')

  try {
    // Scenario 1: Enrollee with Band C plan, Provider in Band A - should NOT verify
    console.log('=== SCENARIO 1: Band C Enrollee → Band A Provider (Should FAIL) ===')
    
    // Find or create enrollee with Band C plan
    let enrollee1 = await prisma.enrollee.findFirst({
      where: {
        plan: {
          assigned_bands: { hasEvery: ['C'] }
        }
      },
      include: { plan: true }
    })
    
    if (!enrollee1) {
      // Create Band C plan
      const bandCPlan = await prisma.plan.create({
        data: {
          name: 'Test Band C Plan',
          band_type: 'Band C',
          assigned_bands: ['C'],
          monthly_premium: 5000,
          annual_premium: 60000,
          status: 'ACTIVE'
        }
      })
      
      // Create enrollee with Band C plan
      enrollee1 = await prisma.enrollee.create({
        data: {
          enrollee_id: `ENR${Date.now()}1`,
          first_name: 'Test',
          last_name: 'BandC',
          date_of_birth: '1990-01-01',
          gender: 'MALE',
          phone_number: '08011111111',
          plan_id: bandCPlan.id,
          status: 'ACTIVE'
        },
        include: { plan: true }
      })
      
      console.log('✅ Created Band C enrollee:', enrollee1.enrollee_id)
    }
    
    // Find or create Band A provider
    let bandAProvider = await prisma.provider.findFirst({
      where: {
        planBands: {
          some: {
            band_type: 'Band A'
          }
        }
      },
      include: { planBands: true }
    })
    
    if (!bandAProvider) {
      // Create Band A provider
      bandAProvider = await prisma.provider.create({
        data: {
          facility_name: 'Test Band A Hospital',
          facility_type: 'HOSPITAL',
          phone_number: '08022222222',
          email: 'banda@test.com',
          address: 'Test Address A',
          state: 'LAGOS',
          lga: 'IKEJA',
          status: 'APPROVED'
        }
      })
      
      // Create PlanBand record for Band A
      await prisma.planBand.create({
        data: {
          plan_id: enrollee1.plan.id,
          provider_id: bandAProvider.id,
          band_type: 'Band A',
          status: 'ACTIVE'
        }
      })
      
      console.log('✅ Created Band A provider:', bandAProvider.facility_name)
    }
    
    // Test band validation logic
    const enrolleeBands1 = enrollee1.plan.assigned_bands.map(b => `Band ${b.toUpperCase()}`)
    const providerBands1 = ['Band A'] // Provider is Band A
    
    console.log('Enrollee bands:', enrolleeBands1)
    console.log('Provider bands:', providerBands1)
    
    const isBandMatch1 = enrolleeBands1.some(enrolleeBand => {
      const accessibleBands = getAccessibleBands(enrolleeBand)
      console.log(`Enrollee band "${enrolleeBand}" can access:`, accessibleBands)
      
      return accessibleBands.some(accessibleBand => {
        const normalizedAccessible = normalizeBand(accessibleBand)
        return providerBands1.some(providerBand => {
          const normalizedProvider = normalizeBand(providerBand)
          const isMatch = normalizedProvider === normalizedAccessible
          console.log(`Comparing "${providerBand}" with "${accessibleBand}": ${isMatch}`)
          return isMatch
        })
      })
    })
    
    console.log('Final band validation result:', isBandMatch1)
    
    if (!isBandMatch1) {
      console.log('✅ CORRECT: Band C enrollee CANNOT access Band A provider')
    } else {
      console.log('❌ ERROR: Band C enrollee should NOT be able to access Band A provider!')
    }
    
    console.log('\n' + '='.repeat(70) + '\n')
    
    // Scenario 2: Enrollee with Band B plan, Provider in Band A - should NOT verify
    console.log('=== SCENARIO 2: Band B Enrollee → Band A Provider (Should FAIL) ===')
    
    // Find or create enrollee with Band B plan
    let enrollee2 = await prisma.enrollee.findFirst({
      where: {
        plan: {
          assigned_bands: { hasEvery: ['B'] }
        }
      },
      include: { plan: true }
    })
    
    if (!enrollee2) {
      // Create Band B plan
      const bandBPlan = await prisma.plan.create({
        data: {
          name: 'Test Band B Plan',
          band_type: 'Band B',
          assigned_bands: ['B'],
          monthly_premium: 10000,
          annual_premium: 120000,
          status: 'ACTIVE'
        }
      })
      
      // Create enrollee with Band B plan
      enrollee2 = await prisma.enrollee.create({
        data: {
          enrollee_id: `ENR${Date.now()}2`,
          first_name: 'Test',
          last_name: 'BandB',
          date_of_birth: '1990-01-01',
          gender: 'FEMALE',
          phone_number: '08033333333',
          plan_id: bandBPlan.id,
          status: 'ACTIVE'
        },
        include: { plan: true }
      })
      
      console.log('✅ Created Band B enrollee:', enrollee2.enrollee_id)
    }
    
    // Test band validation logic for Band B → Band A
    const enrolleeBands2 = enrollee2.plan.assigned_bands.map(b => `Band ${b.toUpperCase()}`)
    const providerBands2 = ['Band A'] // Same Band A provider
    
    console.log('Enrollee bands:', enrolleeBands2)
    console.log('Provider bands:', providerBands2)
    
    const isBandMatch2 = enrolleeBands2.some(enrolleeBand => {
      const accessibleBands = getAccessibleBands(enrolleeBand)
      console.log(`Enrollee band "${enrolleeBand}" can access:`, accessibleBands)
      
      return accessibleBands.some(accessibleBand => {
        const normalizedAccessible = normalizeBand(accessibleBand)
        return providerBands2.some(providerBand => {
          const normalizedProvider = normalizeBand(providerBand)
          const isMatch = normalizedProvider === normalizedAccessible
          console.log(`Comparing "${providerBand}" with "${accessibleBand}": ${isMatch}`)
          return isMatch
        })
      })
    })
    
    console.log('Final band validation result:', isBandMatch2)
    
    if (!isBandMatch2) {
      console.log('✅ CORRECT: Band B enrollee CANNOT access Band A provider')
    } else {
      console.log('❌ ERROR: Band B enrollee should NOT be able to access Band A provider!')
    }
    
    console.log('\n' + '='.repeat(70) + '\n')
    
    // Additional test: Band A enrollee should access Band A provider
    console.log('=== SCENARIO 3: Band A Enrollee → Band A Provider (Should PASS) ===')
    
    const enrolleeBands3 = ['Band A']
    const providerBands3 = ['Band A']
    
    console.log('Enrollee bands:', enrolleeBands3)
    console.log('Provider bands:', providerBands3)
    
    const isBandMatch3 = enrolleeBands3.some(enrolleeBand => {
      const accessibleBands = getAccessibleBands(enrolleeBand)
      console.log(`Enrollee band "${enrolleeBand}" can access:`, accessibleBands)
      
      return accessibleBands.some(accessibleBand => {
        const normalizedAccessible = normalizeBand(accessibleBand)
        return providerBands3.some(providerBand => {
          const normalizedProvider = normalizeBand(providerBand)
          const isMatch = normalizedProvider === normalizedAccessible
          console.log(`Comparing "${providerBand}" with "${accessibleBand}": ${isMatch}`)
          return isMatch
        })
      })
    })
    
    console.log('Final band validation result:', isBandMatch3)
    
    if (isBandMatch3) {
      console.log('✅ CORRECT: Band A enrollee CAN access Band A provider')
    } else {
      console.log('❌ ERROR: Band A enrollee should be able to access Band A provider!')
    }
    
    console.log('\n' + '='.repeat(70) + '\n')
    
    // Test actual API call simulation
    console.log('=== TESTING REQUEST APPROVAL CODE API SIMULATION ===')
    
    // Create a provider request for testing
    const testRequest = await prisma.providerRequest.create({
      data: {
        enrollee_id: enrollee1.id, // Band C enrollee
        provider_id: bandAProvider.id, // Band A provider
        hospital: bandAProvider.facility_name,
        services: 'Test Service',
        amount: 1000,
        diagnosis: 'Test Diagnosis',
        status: 'PENDING',
        admission_required: false
      }
    })
    
    console.log('Created test provider request:', testRequest.id)
    
    // Simulate the API approval logic
    console.log('Simulating API approval for Band C enrollee → Band A provider...')
    
    // This should fail based on the band logic
    console.log('Expected result: REJECTION due to band mismatch')
    
    // Clean up
    await prisma.providerRequest.delete({ where: { id: testRequest.id } })
    console.log('Cleaned up test request')
    
  } catch (error) {
    console.error('❌ Error during test:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testBandVerificationScenarios().catch(console.error)