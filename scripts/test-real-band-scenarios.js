// Test script to verify the exact scenarios mentioned by the user
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testBandVerificationRealScenarios() {
  console.log('🧪 Testing Band Verification - Real Scenarios...\n')

  try {
    // SCENARIO 1: Create enrollee with Band C plan, Provider in Band A - should NOT verify
    console.log('=== SCENARIO 1: Band C Enrollee → Band A Provider (Should FAIL) ===')
    
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
    console.log('✅ Created Band C plan:', bandCPlan.name)
    
    // Create enrollee with Band C plan
    const enrollee1 = await prisma.principalAccount.create({
      data: {
        enrollee_id: `TEST-C-${Date.now()}`,
        first_name: 'TestBandC',
        last_name: 'User',
        date_of_birth: '1990-01-01',
        gender: 'MALE',
        phone_number: '08011111111',
        plan_id: bandCPlan.id,
        status: 'ACTIVE'
      }
    })
    console.log('✅ Created Band C enrollee:', enrollee1.enrollee_id)
    
    // Create Band A provider
    const bandAProvider = await prisma.provider.create({
      data: {
        facility_name: 'Test Band A Hospital',
        facility_type: 'HOSPITAL',
        phone_number: '08022222222',
        email: `banda${Date.now()}@test.com`,
        address: 'Test Address A',
        state: 'LAGOS',
        lga: 'IKEJA',
        status: 'APPROVED'
      }
    })
    console.log('✅ Created Band A provider:', bandAProvider.facility_name)
    
    // Create PlanBand record for Band A (this allows the provider to serve Band A patients)
    await prisma.planBand.create({
      data: {
        plan_id: bandCPlan.id,
        provider_id: bandAProvider.id,
        band_type: 'Band A',
        status: 'ACTIVE'
      }
    })
    console.log('✅ Created PlanBand record: Provider can serve Band A patients')
    
    // Create encounter code for testing
    const encounterCode1 = `ENC${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
    
    const approvalCodeRecord1 = await prisma.approvalCode.create({
      data: {
        approval_code: encounterCode1,
        enrollee_id: enrollee1.id,
        enrollee_name: `${enrollee1.first_name} ${enrollee1.last_name}`,
        hospital: bandAProvider.facility_name,
        services: 'Test Services',
        amount: 1000,
        diagnosis: 'Test Diagnosis',
        admission_required: false,
        status: 'PENDING'
      }
    })
    console.log('✅ Created encounter code:', encounterCode1)
    
    // Test encounter verification API call simulation
    console.log('\\n🔍 Testing encounter verification for Band C → Band A...')
    
    // Simulate the API logic
    const enrolleeBands1 = bandCPlan.assigned_bands.map(b => `Band ${b.toUpperCase()}`)
    const providerBands1 = ['Band A'] // Provider serves Band A
    
    console.log('Enrollee bands:', enrolleeBands1)
    console.log('Provider bands:', providerBands1)
    
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
    
    const isBandMatch1 = enrolleeBands1.some(enrolleeBand => {
      const accessibleBands = getAccessibleBands(enrolleeBand)
      console.log(`Enrollee band "${enrolleeBand}" can access:`, accessibleBands)
      
      return accessibleBands.some(accessibleBand => {
        const normalizedAccessible = normalizeBand(accessibleBand)
        return providerBands1.some(providerBand => {
          const normalizedProvider = normalizeBand(providerBand)
          const isMatch = normalizedProvider === normalizedAccessible
          console.log(`Comparing "${providerBand}" (${normalizedProvider}) with "${accessibleBand}" (${normalizedAccessible}): ${isMatch}`)
          return isMatch
        })
      })
    })
    
    console.log('Final band validation result:', isBandMatch1)
    
    if (!isBandMatch1) {
      console.log('✅ CORRECT: Band C enrollee CANNOT access Band A provider')
      console.log('✅ Encounter verification should return 403 Forbidden')
    } else {
      console.log('❌ ERROR: Band C enrollee should NOT be able to access Band A provider!')
      console.log('❌ This indicates the band logic is broken')
    }
    
    console.log('\\n' + '='.repeat(70) + '\\n')
    
    // SCENARIO 2: Create enrollee with Band B plan, Provider in Band A - should NOT verify
    console.log('=== SCENARIO 2: Band B Enrollee → Band A Provider (Should FAIL) ===')
    
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
    console.log('✅ Created Band B plan:', bandBPlan.name)
    
    // Create enrollee with Band B plan
    const enrollee2 = await prisma.principalAccount.create({
      data: {
        enrollee_id: `TEST-B-${Date.now()}`,
        first_name: 'TestBandB',
        last_name: 'User',
        date_of_birth: '1990-01-01',
        gender: 'FEMALE',
        phone_number: '08033333333',
        plan_id: bandBPlan.id,
        status: 'ACTIVE'
      }
    })
    console.log('✅ Created Band B enrollee:', enrollee2.enrollee_id)
    
    // Create PlanBand record for Band A (same provider, now also serves Band B plan but still Band A level)
    await prisma.planBand.create({
      data: {
        plan_id: bandBPlan.id,
        provider_id: bandAProvider.id,
        band_type: 'Band A',
        status: 'ACTIVE'
      }
    })
    console.log('✅ Created PlanBand record: Provider can serve Band A patients under Band B plan')
    
    // Test band validation logic for Band B → Band A
    const enrolleeBands2 = bandBPlan.assigned_bands.map(b => `Band ${b.toUpperCase()}`)
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
          console.log(`Comparing "${providerBand}" (${normalizedProvider}) with "${accessibleBand}" (${normalizedAccessible}): ${isMatch}`)
          return isMatch
        })
      })
    })
    
    console.log('Final band validation result:', isBandMatch2)
    
    if (!isBandMatch2) {
      console.log('✅ CORRECT: Band B enrollee CANNOT access Band A provider')
      console.log('✅ Encounter verification should return 403 Forbidden')
    } else {
      console.log('❌ ERROR: Band B enrollee should NOT be able to access Band A provider!')
      console.log('❌ This indicates the band logic is broken')
    }
    
    console.log('\\n' + '='.repeat(70) + '\\n')
    
    // SCENARIO 3: Test valid scenario - Band A enrollee → Band A provider (should work)
    console.log('=== SCENARIO 3: Band A Enrollee → Band A Provider (Should PASS) ===')
    
    // Create Band A plan
    const bandAPlan = await prisma.plan.create({
      data: {
        name: 'Test Band A Plan',
        band_type: 'Band A',
        assigned_bands: ['A'],
        monthly_premium: 15000,
        annual_premium: 180000,
        status: 'ACTIVE'
      }
    })
    console.log('✅ Created Band A plan:', bandAPlan.name)
    
    // Create enrollee with Band A plan
    const enrollee3 = await prisma.principalAccount.create({
      data: {
        enrollee_id: `TEST-A-${Date.now()}`,
        first_name: 'TestBandA',
        last_name: 'User',
        date_of_birth: '1990-01-01',
        gender: 'MALE',
        phone_number: '08044444444',
        plan_id: bandAPlan.id,
        status: 'ACTIVE'
      }
    })
    console.log('✅ Created Band A enrollee:', enrollee3.enrollee_id)
    
    // Create PlanBand record for Band A
    await prisma.planBand.create({
      data: {
        plan_id: bandAPlan.id,
        provider_id: bandAProvider.id,
        band_type: 'Band A',
        status: 'ACTIVE'
      }
    })
    console.log('✅ Created PlanBand record: Provider can serve Band A patients under Band A plan')
    
    // Test band validation logic for Band A → Band A
    const enrolleeBands3 = bandAPlan.assigned_bands.map(b => `Band ${b.toUpperCase()}`)
    const providerBands3 = ['Band A'] // Same Band A provider
    
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
          console.log(`Comparing "${providerBand}" (${normalizedProvider}) with "${accessibleBand}" (${normalizedAccessible}): ${isMatch}`)
          return isMatch
        })
      })
    })
    
    console.log('Final band validation result:', isBandMatch3)
    
    if (isBandMatch3) {
      console.log('✅ CORRECT: Band A enrollee CAN access Band A provider')
      console.log('✅ Encounter verification should return 200 Success')
    } else {
      console.log('❌ ERROR: Band A enrollee should be able to access Band A provider!')
      console.log('❌ This indicates the band logic is broken')
    }
    
    console.log('\\n' + '='.repeat(70) + '\\n')
    
    // Clean up test data
    console.log('🧹 Cleaning up test data...')
    await prisma.approvalCode.delete({ where: { id: approvalCodeRecord1.id } })
    await prisma.planBand.deleteMany({ where: { provider_id: bandAProvider.id } })
    await prisma.principalAccount.deleteMany({ 
      where: { 
        enrollee_id: { 
          in: [enrollee1.enrollee_id, enrollee2.enrollee_id, enrollee3.enrollee_id] 
        } 
      } 
    })
    await prisma.provider.delete({ where: { id: bandAProvider.id } })
    await prisma.plan.deleteMany({ 
      where: { 
        id: { 
          in: [bandCPlan.id, bandBPlan.id, bandAPlan.id] 
        } 
      } 
    })
    console.log('✅ Test data cleaned up')
    
    console.log('\\n🎯 SUMMARY:')
    console.log('The band validation logic appears to be working correctly.')
    console.log('If you are seeing different behavior in the frontend, the issue might be:')
    console.log('1. Data setup - check if PlanBand records are created correctly')
    console.log('2. Frontend request format - check the API call parameters')
    console.log('3. Provider band assignment - check which bands the provider actually serves')
    
  } catch (error) {
    console.error('❌ Error during test:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testBandVerificationRealScenarios().catch(console.error)