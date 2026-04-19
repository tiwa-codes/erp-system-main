const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testActualEncounterVerification() {
  try {
    console.log('🧪 Testing Actual Encounter Verification API...\n')

    // Step 1: Create test data
    console.log('📋 Step 1: Creating test data...')
    
    // Find Fatima (Band C enrollee)
    const fatima = await prisma.principalAccount.findFirst({
      where: { enrollee_id: 'CJH/CJ/003' },
      include: { plan: true }
    })

    // Find Nyanya (Band A provider)
    const nyanya = await prisma.provider.findFirst({
      where: { facility_name: { contains: 'Nyanya', mode: 'insensitive' } }
    })

    console.log('👤 Fatima (Band C):', fatima.enrollee_id, '- Plan:', fatima.plan?.name, '- Bands:', fatima.plan?.assigned_bands)
    console.log('🏥 Nyanya (Band A):', nyanya.facility_name, '- Bands:', nyanya.selected_bands)

    // Step 2: Generate encounter code
    console.log('\n📋 Step 2: Generating encounter code...')
    
    const encounterCode = `ENC${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
    
    const approvalCodeRecord = await prisma.approvalCode.create({
      data: {
        approval_code: encounterCode,
        enrollee_id: fatima.id,
        enrollee_name: `${fatima.first_name} ${fatima.last_name}`,
        hospital: nyanya.facility_name,
        services: 'Test Services',
        amount: 0,
        diagnosis: 'Test Diagnosis',
        admission_required: false,
        status: 'PENDING',
        generated_by_id: (await prisma.user.findFirst()).id
      }
    })

    console.log('✅ Encounter code generated:', encounterCode)

    // Step 3: Test the actual verification logic from the API
    console.log('\n📋 Step 3: Testing verification logic...')
    
    // This simulates the exact logic from /api/encounter/verify/route.ts
    const enrolleePlan = await prisma.plan.findUnique({
      where: { id: fatima.plan_id },
      select: {
        id: true,
        name: true,
        assigned_bands: true,
        band_type: true
      }
    })

    console.log('📊 Enrollee Plan Details:')
    console.log('   Plan Name:', enrolleePlan?.name)
    console.log('   Assigned Bands:', enrolleePlan?.assigned_bands)
    console.log('   Band Type:', enrolleePlan?.band_type)

    // Determine enrollee's band(s) - EXACT logic from API
    const enrolleeBands = enrolleePlan?.assigned_bands && enrolleePlan.assigned_bands.length > 0 
      ? enrolleePlan.assigned_bands 
      : (enrolleePlan?.band_type ? [enrolleePlan.band_type] : ["Band A"])

    console.log('🎯 Enrollee Bands:', enrolleeBands)

    // Check if provider is accessible under any of the enrollee's bands
    const planBands = await prisma.planBand.findMany({
      where: {
        plan_id: fatima.plan_id,
        provider_id: nyanya.id,
        status: 'ACTIVE'
      }
    })

    console.log('📋 Plan Bands Found:', planBands.length)
    if (planBands.length > 0) {
      console.log('   Provider Bands:', planBands.map(pb => pb.band_type))
    }

    // Helper function to get accessible bands based on hierarchical access - EXACT logic from API
    const getAccessibleBands = (enrolleeBand) => {
      const band = enrolleeBand.toLowerCase().trim()
      console.log('   Processing enrollee band:', enrolleeBand, 'normalized to:', band)
      
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
          console.log('   Unknown band format:', band, 'returning original:', enrolleeBand)
          return [enrolleeBand] // Default to same band
      }
    }

    // Helper function to normalize band names for comparison - EXACT logic from API
    const normalizeBand = (band) => {
      const normalized = band.toLowerCase().trim()
      if (normalized === 'a' || normalized === 'band a') return 'Band A'
      if (normalized === 'b' || normalized === 'band b') return 'Band B'
      if (normalized === 'c' || normalized === 'band c') return 'Band C'
      return band // Return original if not recognized
    }

    // If no PlanBand records exist, check if we can determine provider bands from other sources - EXACT logic from API
    let providerBands = []
    let isBandMatch = false

    if (planBands.length === 0) {
      console.log("⚠️  No PlanBand records found, checking alternative band sources...")
      
      // Check if provider has any band information in their record
      const providerWithBands = await prisma.provider.findUnique({
        where: { id: nyanya.id },
        select: {
          id: true,
          facility_name: true,
          facility_type: true
        }
      })

      if (providerWithBands) {
        console.log("   Provider found:", providerWithBands.facility_name)
        
        // For now, assume provider can serve all bands if no specific PlanBand records exist
        providerBands = ["Band A", "Band B", "Band C"]
        console.log("   Using fallback band assignment:", providerBands)
      } else {
        console.log("   Provider not found")
        providerBands = ["Band A", "Band B", "Band C"]
      }
    } else {
      // Use the PlanBand records
      providerBands = planBands.map(pb => pb.band_type)
      console.log("   Using PlanBand records:", providerBands)
    }

    console.log('\n🔍 Band Validation Debug:')
    console.log('   Enrollee bands (raw):', enrolleeBands)
    console.log('   Provider bands (raw):', providerBands)
    
    // Check if enrollee's bands have hierarchical access to provider's bands - EXACT logic from API
    isBandMatch = enrolleeBands.some(enrolleeBand => {
      const accessibleBands = getAccessibleBands(enrolleeBand)
      console.log(`   Enrollee band "${enrolleeBand}" can access:`, accessibleBands)
      
      const hasMatch = accessibleBands.some(accessibleBand => {
        const normalizedAccessible = normalizeBand(accessibleBand)
        const providerMatch = providerBands.some(providerBand => {
          const normalizedProvider = normalizeBand(providerBand)
          const isMatch = normalizedProvider === normalizedAccessible
          console.log(`     Comparing "${providerBand}" (${normalizedProvider}) with "${accessibleBand}" (${normalizedAccessible}): ${isMatch}`)
          return isMatch
        })
        return providerMatch
      })
      
      console.log(`   Enrollee band "${enrolleeBand}" has match:`, hasMatch)
      return hasMatch
    })

    console.log('\n🎯 Final Band Validation Result:', isBandMatch)

    if (isBandMatch) {
      console.log('✅ SUCCESS: Band validation passed - provider accessible under hierarchical band access')
      console.log('   This means the verification should work correctly!')
    } else {
      console.log('❌ FAILURE: Band validation failed - provider bands do not match enrollee\'s accessible bands')
      console.log('   This means the verification should be rejected!')
    }

    // Step 4: Check what the API would actually return
    console.log('\n📋 Step 4: API Response Simulation...')
    
    if (!isBandMatch) {
      const accessibleBandsSummary = enrolleeBands.map(eb => 
        `${eb} (access to: ${getAccessibleBands(eb).join(", ")})`
      ).join(", ")
      
      console.log('🚫 API would return 403 Forbidden with message:')
      console.log(`   "This enrollee's band(s) (${accessibleBandsSummary}) does not cover services at this provider (Bands: ${providerBands.join(", ")})"`)
    } else {
      console.log('✅ API would return 200 Success')
    }

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...')
    await prisma.approvalCode.delete({ where: { id: approvalCodeRecord.id } })
    console.log('✅ Test data cleaned up')

  } catch (error) {
    console.error('❌ Error during test:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testActualEncounterVerification()
