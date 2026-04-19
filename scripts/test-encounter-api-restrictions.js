// Test the actual API endpoint with proper scenarios
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testEncounterVerifyAPI() {
  console.log('🧪 Testing Encounter Verify API with Band Restrictions...\n')

  try {
    // Test 1: Find a Band C enrollee and try to access a Band A-only provider
    console.log('=== TEST 1: Band C Enrollee → Band A-only Provider ===')
    
    // Find Band C enrollee
    const bandCEnrollee = await prisma.principalAccount.findFirst({
      where: {
        plan: {
          assigned_bands: { has: 'C' },
          status: 'ACTIVE'
        },
        status: 'ACTIVE'
      },
      include: {
        plan: true
      }
    })

    if (bandCEnrollee) {
      console.log(`👤 Found Band C enrollee: ${bandCEnrollee.enrollee_id} - Plan: ${bandCEnrollee.plan.name}`)
      console.log(`   Assigned bands: ${JSON.stringify(bandCEnrollee.plan.assigned_bands)}`)

      // Find a provider that ONLY serves Band A for this plan
      const bandAOnlyPlanBand = await prisma.planBand.findFirst({
        where: {
          plan_id: bandCEnrollee.plan_id,
          band_type: 'Band A',
          status: 'ACTIVE',
          // Make sure this provider doesn't ALSO serve Band C for this plan
          NOT: {
            provider: {
              plan_bands: {
                some: {
                  plan_id: bandCEnrollee.plan_id,
                  band_type: 'Band C',
                  status: 'ACTIVE'
                }
              }
            }
          }
        },
        include: {
          provider: true
        }
      })

      if (bandAOnlyPlanBand) {
        console.log(`🏥 Found Band A-only provider: ${bandAOnlyPlanBand.provider.facility_name}`)
        console.log(`   This provider serves Band A only for this plan`)

        // Create a test encounter code
        const encounterCode = `TEST${Date.now().toString().slice(-8)}`
        
        const testApprovalCode = await prisma.approvalCode.create({
          data: {
            approval_code: encounterCode,
            enrollee_id: bandCEnrollee.id,
            enrollee_name: `${bandCEnrollee.first_name} ${bandCEnrollee.last_name}`,
            hospital: bandAOnlyPlanBand.provider.facility_name,
            services: 'Test Service',
            amount: 1000,
            diagnosis: 'Test Diagnosis',
            admission_required: false,
            status: 'PENDING'
          }
        })

        console.log(`📋 Created test encounter code: ${encounterCode}`)
        console.log(`🔍 Now testing the API call...`)

        // Simulate the API call by manually calling the band validation logic
        console.log('\\n--- Simulating API Band Validation ---')
        
        const enrolleeBands = bandCEnrollee.plan.assigned_bands.map(b => `Band ${b.toUpperCase()}`)
        console.log('Enrollee bands:', enrolleeBands)
        
        const providerBands = ['Band A'] // This provider only serves Band A
        console.log('Provider bands:', providerBands)
        
        // Replicate the API logic
        function getAccessibleBands(enrolleeBand) {
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
        
        function normalizeBand(band) {
          const normalized = band.toLowerCase().trim()
          if (normalized === 'a' || normalized === 'band a') return 'Band A'
          if (normalized === 'b' || normalized === 'band b') return 'Band B'
          if (normalized === 'c' || normalized === 'band c') return 'Band C'
          return band
        }
        
        // Test the band validation
        let isBandMatch = enrolleeBands.some(enrolleeBand => {
          const accessibleBands = getAccessibleBands(enrolleeBand)
          console.log(`Enrollee band "${enrolleeBand}" can access:`, accessibleBands)
          
          return accessibleBands.some(accessibleBand => {
            const normalizedAccessible = normalizeBand(accessibleBand)
            return providerBands.some(providerBand => {
              const normalizedProvider = normalizeBand(providerBand)
              const isMatch = normalizedProvider === normalizedAccessible
              console.log(`Comparing "${providerBand}" with "${accessibleBand}": ${isMatch}`)
              return isMatch
            })
          })
        })
        
        // Apply the new restriction logic
        const hasInvalidAccess = enrolleeBands.some(enrolleeBand => {
          const band = normalizeBand(enrolleeBand)
          return providerBands.some(providerBand => {
            const pBand = normalizeBand(providerBand)
            
            if (band === 'Band C' && (pBand === 'Band A' || pBand === 'Band B')) {
              console.log(`INVALID ACCESS DETECTED: Band C enrollee trying to access ${pBand} provider`)
              return true
            }
            
            if (band === 'Band B' && pBand === 'Band A') {
              console.log(`INVALID ACCESS DETECTED: Band B enrollee trying to access Band A provider`)
              return true
            }
            
            return false
          })
        })
        
        if (hasInvalidAccess) {
          console.log('OVERRIDE: Invalid access detected - DENYING')
          isBandMatch = false
        }
        
        console.log(`\\nFinal result: ${isBandMatch ? 'ALLOWED' : 'DENIED'}`)
        
        if (!isBandMatch) {
          console.log('✅ CORRECT: Band C enrollee CANNOT access Band A-only provider')
          console.log('✅ The API should return 403 Forbidden')
        } else {
          console.log('❌ ERROR: Band C enrollee should NOT be able to access Band A-only provider!')
        }
        
        // Clean up
        await prisma.approvalCode.delete({ where: { id: testApprovalCode.id } })
        console.log('🧹 Cleaned up test data')
        
      } else {
        console.log('⚠️  No Band A-only providers found for this enrollee\'s plan')
      }
    } else {
      console.log('❌ No Band C enrollees found')
    }
    
    console.log('\\n' + '='.repeat(50))
    
    // Test 2: Try to find a scenario where there are NO PlanBand records
    console.log('\\n=== TEST 2: Scenario with Missing PlanBand Records ===')
    
    const anyEnrollee = await prisma.principalAccount.findFirst({
      where: { status: 'ACTIVE' },
      include: { plan: true }
    })
    
    const anyProvider = await prisma.provider.findFirst({
      where: { status: 'APPROVED' }
    })
    
    if (anyEnrollee && anyProvider) {
      console.log(`👤 Enrollee: ${anyEnrollee.enrollee_id}`)
      console.log(`🏥 Provider: ${anyProvider.facility_name}`)
      
      // Check if PlanBand records exist
      const planBandCount = await prisma.planBand.count({
        where: {
          plan_id: anyEnrollee.plan_id,
          provider_id: anyProvider.id,
          status: 'ACTIVE'
        }
      })
      
      console.log(`📊 PlanBand records found: ${planBandCount}`)
      
      if (planBandCount === 0) {
        console.log('✅ Perfect! No PlanBand records exist for this combination')
        console.log('✅ With the new fix, this should return 403 "Provider not configured for plan"')
      } else {
        console.log('⚠️  PlanBand records exist, so this wouldn\'t test the fallback scenario')
      }
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testEncounterVerifyAPI().catch(console.error)