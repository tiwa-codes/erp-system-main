import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testProviderApprovalBanding() {
  console.log('=== TESTING PROVIDER APPROVAL BANDING ===\n')

  try {
    // Test scenarios based on actual data
    const testCases = [
      {
        enrolleeName: 'Yusuf Yusuf',
        enrolleeId: 'CJH/CJ/001',
        planName: 'Crown Jewel - Gold',
        expectedBands: ['Band B'],
        providerName: 'City General Hospital',
        shouldWork: true,
        description: 'Band B enrollee accessing Band B provider (should work)'
      },
      {
        enrolleeName: 'John Doe',
        enrolleeId: 'CJH/SC001/000001',
        planName: 'Basic Health Plan',
        expectedBands: ['Band C'],
        providerName: 'City General Hospital',
        shouldWork: true,
        description: 'Band C enrollee accessing Band C provider (should work)'
      },
      {
        enrolleeName: 'John Doe',
        enrolleeId: 'CJH/SC001/000001',
        planName: 'Basic Health Plan',
        expectedBands: ['Band C'],
        providerName: 'Metro Health Center',
        shouldWork: true,
        description: 'Band C enrollee accessing Band C provider (should work)'
      }
    ]

    // Helper functions (same as in the API)
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

    // Test each scenario
    for (const testCase of testCases) {
      console.log(`\n--- Testing: ${testCase.description} ---`)
      
      // Find enrollee
      const enrollee = await prisma.principalAccount.findFirst({
        where: { enrollee_id: testCase.enrolleeId },
        include: {
          plan: {
            select: {
              name: true,
              assigned_bands: true,
              band_type: true
            }
          }
        }
      })

      if (!enrollee) {
        console.log(`❌ Enrollee not found: ${testCase.enrolleeId}`)
        continue
      }

      // Find provider
      const provider = await prisma.provider.findFirst({
        where: { facility_name: { contains: testCase.providerName, mode: "insensitive" } }
      })

      if (!provider) {
        console.log(`❌ Provider not found: ${testCase.providerName}`)
        continue
      }

      // Get enrollee's bands
      const enrolleeBands = enrollee.plan.assigned_bands && enrollee.plan.assigned_bands.length > 0 
        ? enrollee.plan.assigned_bands.map(b => `Band ${b.toUpperCase()}`)
        : (enrollee.plan.band_type ? [enrollee.plan.band_type] : ["Band A"])

      // Get provider's bands from PlanBand
      const planBands = await prisma.planBand.findMany({
        where: {
          plan_id: enrollee.plan_id,
          provider_id: provider.id,
          status: 'ACTIVE'
        }
      })

      const providerBands = planBands.map(pb => pb.band_type)

      console.log(`Enrollee: ${enrollee.first_name} ${enrollee.last_name}`)
      console.log(`Plan: ${enrollee.plan.name}`)
      console.log(`Enrollee Bands: ${JSON.stringify(enrolleeBands)}`)
      console.log(`Provider: ${provider.facility_name}`)
      console.log(`Provider Bands: ${JSON.stringify(providerBands)}`)

      // Test band validation logic (same as in the updated API)
      const isBandMatch = enrolleeBands.some(enrolleeBand => {
        const accessibleBands = getAccessibleBands(enrolleeBand)
        console.log(`  Enrollee band "${enrolleeBand}" can access: ${JSON.stringify(accessibleBands)}`)
        
        const hasMatch = accessibleBands.some(accessibleBand => {
          const normalizedAccessible = normalizeBand(accessibleBand)
          const providerMatch = providerBands.some(providerBand => {
            const normalizedProvider = normalizeBand(providerBand)
            const isMatch = normalizedProvider === normalizedAccessible
            console.log(`    Comparing "${providerBand}" (${normalizedProvider}) with "${accessibleBand}" (${normalizedAccessible}): ${isMatch}`)
            return isMatch
          })
          return providerMatch
        })
        
        console.log(`  Enrollee band "${enrolleeBand}" has match: ${hasMatch}`)
        return hasMatch
      })

      console.log(`Final Result: ${isBandMatch ? '✅ PASS' : '❌ FAIL'}`)
      console.log(`Expected: ${testCase.shouldWork ? 'Should work' : 'Should fail'}`)
      
      if (isBandMatch === testCase.shouldWork) {
        console.log(`✅ Test passed!`)
      } else {
        console.log(`❌ Test failed! Expected ${testCase.shouldWork}, got ${isBandMatch}`)
      }
    }

    // Test hierarchical access scenarios
    console.log('\n=== TESTING HIERARCHICAL ACCESS SCENARIOS ===')
    
    const hierarchicalTests = [
      {
        enrolleeBand: 'Band A',
        providerBands: ['Band A'],
        expected: true,
        description: 'Band A enrollee accessing Band A provider'
      },
      {
        enrolleeBand: 'Band A',
        providerBands: ['Band B'],
        expected: true,
        description: 'Band A enrollee accessing Band B provider (hierarchical)'
      },
      {
        enrolleeBand: 'Band A',
        providerBands: ['Band C'],
        expected: true,
        description: 'Band A enrollee accessing Band C provider (hierarchical)'
      },
      {
        enrolleeBand: 'Band B',
        providerBands: ['Band A'],
        expected: false,
        description: 'Band B enrollee accessing Band A provider (should fail)'
      },
      {
        enrolleeBand: 'Band B',
        providerBands: ['Band B'],
        expected: true,
        description: 'Band B enrollee accessing Band B provider'
      },
      {
        enrolleeBand: 'Band B',
        providerBands: ['Band C'],
        expected: true,
        description: 'Band B enrollee accessing Band C provider (hierarchical)'
      },
      {
        enrolleeBand: 'Band C',
        providerBands: ['Band A'],
        expected: false,
        description: 'Band C enrollee accessing Band A provider (should fail)'
      },
      {
        enrolleeBand: 'Band C',
        providerBands: ['Band B'],
        expected: false,
        description: 'Band C enrollee accessing Band B provider (should fail)'
      },
      {
        enrolleeBand: 'Band C',
        providerBands: ['Band C'],
        expected: true,
        description: 'Band C enrollee accessing Band C provider'
      }
    ]

    hierarchicalTests.forEach(test => {
      const accessibleBands = getAccessibleBands(test.enrolleeBand)
      const hasMatch = accessibleBands.some(accessibleBand => {
        const normalizedAccessible = normalizeBand(accessibleBand)
        return test.providerBands.some(providerBand => {
          const normalizedProvider = normalizeBand(providerBand)
          return normalizedProvider === normalizedAccessible
        })
      })
      
      const result = hasMatch === test.expected ? '✅ PASS' : '❌ FAIL'
      console.log(`${result} ${test.description}: ${hasMatch} (expected ${test.expected})`)
    })

    // Test with actual APR- codes
    console.log('\n=== TESTING WITH ACTUAL APR- CODES ===')
    
    const aprCodes = await prisma.approvalCode.findMany({
      where: {
        approval_code: { startsWith: 'APR-' }
      },
      include: {
        enrollee: {
          include: {
            plan: {
              select: {
                name: true,
                assigned_bands: true,
                band_type: true
              }
            }
          }
        }
      },
      take: 3
    })

    console.log(`Found ${aprCodes.length} APR- codes to test`)
    
    aprCodes.forEach(code => {
      console.log(`\nTesting APR- code: ${code.approval_code}`)
      console.log(`Enrollee: ${code.enrollee_name}`)
      console.log(`Hospital: ${code.hospital}`)
      
      if (code.enrollee?.plan) {
        const enrolleeBands = code.enrollee.plan.assigned_bands && code.enrollee.plan.assigned_bands.length > 0 
          ? code.enrollee.plan.assigned_bands.map(b => `Band ${b.toUpperCase()}`)
          : (code.enrollee.plan.band_type ? [code.enrollee.plan.band_type] : ["Band A"])
        
        console.log(`Plan: ${code.enrollee.plan.name}`)
        console.log(`Enrollee Bands: ${JSON.stringify(enrolleeBands)}`)
        
        // Find the provider for this hospital
        const provider = prisma.provider.findFirst({
          where: { facility_name: { contains: code.hospital, mode: "insensitive" } }
        })
        
        if (provider) {
          console.log(`Provider found: ${provider.facility_name}`)
        } else {
          console.log(`Provider not found for hospital: ${code.hospital}`)
        }
      } else {
        console.log(`No enrollee or plan information found`)
      }
    })

  } catch (error) {
    console.error('Error testing provider approval banding:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testProviderApprovalBanding()
