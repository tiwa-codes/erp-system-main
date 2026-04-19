// Test script to verify hierarchical band access logic
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Replicate the getAccessibleBands function from the API
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

// Helper function to normalize band names for comparison
function normalizeBand(band) {
  const normalized = band.toLowerCase().trim()
  if (normalized === 'a' || normalized === 'band a') return 'Band A'
  if (normalized === 'b' || normalized === 'band b') return 'Band B'
  if (normalized === 'c' || normalized === 'band c') return 'Band C'
  return band // Return original if not recognized
}

async function testHierarchicalBandAccess() {
  console.log('🧪 Testing Hierarchical Band Access Logic...\n')

  try {
    // Test cases for hierarchical band access
    const testCases = [
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
        description: 'Band A enrollee accessing Band B provider'
      },
      {
        enrolleeBand: 'Band A',
        providerBands: ['Band C'],
        expected: true,
        description: 'Band A enrollee accessing Band C provider'
      },
      {
        enrolleeBand: 'Band B',
        providerBands: ['Band A'],
        expected: false,
        description: 'Band B enrollee accessing Band A provider (should be denied)'
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
        description: 'Band B enrollee accessing Band C provider'
      },
      {
        enrolleeBand: 'Band C',
        providerBands: ['Band A'],
        expected: false,
        description: 'Band C enrollee accessing Band A provider (should be denied)'
      },
      {
        enrolleeBand: 'Band C',
        providerBands: ['Band B'],
        expected: false,
        description: 'Band C enrollee accessing Band B provider (should be denied)'
      },
      {
        enrolleeBand: 'Band C',
        providerBands: ['Band C'],
        expected: true,
        description: 'Band C enrollee accessing Band C provider'
      }
    ]

    console.log('Testing hierarchical band access logic:\n')

    let passedTests = 0
    let totalTests = testCases.length

    for (const testCase of testCases) {
      console.log(`📋 Test: ${testCase.description}`)
      console.log(`   Enrollee Band: ${testCase.enrolleeBand}`)
      console.log(`   Provider Bands: ${testCase.providerBands.join(', ')}`)
      
      // Get accessible bands for enrollee
      const accessibleBands = getAccessibleBands(testCase.enrolleeBand)
      console.log(`   Accessible Bands: ${accessibleBands.join(', ')}`)
      
      // Check if any provider band matches accessible bands
      const hasMatch = accessibleBands.some(accessibleBand => {
        const normalizedAccessible = normalizeBand(accessibleBand)
        return testCase.providerBands.some(providerBand => {
          const normalizedProvider = normalizeBand(providerBand)
          return normalizedProvider === normalizedAccessible
        })
      })
      
      const testPassed = hasMatch === testCase.expected
      console.log(`   Expected: ${testCase.expected}, Got: ${hasMatch}`)
      console.log(`   Result: ${testPassed ? '✅ PASS' : '❌ FAIL'}`)
      
      if (testPassed) passedTests++
      console.log('')
    }

    console.log(`🎯 Test Results: ${passedTests}/${totalTests} tests passed`)
    
    if (passedTests === totalTests) {
      console.log('🎉 All tests passed! Hierarchical band access logic is working correctly.')
    } else {
      console.log('❌ Some tests failed. The hierarchical band access logic needs review.')
    }

    // Test with actual database data
    console.log('\n📊 Testing with actual database data:')
    
    // Find a Band A enrollee
    const bandAEnrollee = await prisma.principalAccount.findFirst({
      where: {
        plan: {
          OR: [
            { assigned_bands: { has: 'A' } },
            { assigned_bands: { has: 'Band A' } },
            { band_type: 'Band A' }
          ]
        }
      },
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

    if (bandAEnrollee) {
      console.log(`✅ Found Band A enrollee: ${bandAEnrollee.first_name} ${bandAEnrollee.last_name}`)
      console.log(`   Plan: ${bandAEnrollee.plan?.name}`)
      console.log(`   Assigned Bands: ${bandAEnrollee.plan?.assigned_bands?.join(', ') || 'None'}`)
      console.log(`   Band Type: ${bandAEnrollee.plan?.band_type || 'None'}`)
    } else {
      console.log('❌ No Band A enrollee found in database')
    }

    // Find a Band C enrollee
    const bandCEnrollee = await prisma.principalAccount.findFirst({
      where: {
        plan: {
          OR: [
            { assigned_bands: { has: 'C' } },
            { assigned_bands: { has: 'Band C' } },
            { band_type: 'Band C' }
          ]
        }
      },
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

    if (bandCEnrollee) {
      console.log(`✅ Found Band C enrollee: ${bandCEnrollee.first_name} ${bandCEnrollee.last_name}`)
      console.log(`   Plan: ${bandCEnrollee.plan?.name}`)
      console.log(`   Assigned Bands: ${bandCEnrollee.plan?.assigned_bands?.join(', ') || 'None'}`)
      console.log(`   Band Type: ${bandCEnrollee.plan?.band_type || 'None'}`)
    } else {
      console.log('❌ No Band C enrollee found in database')
    }

  } catch (error) {
    console.error('❌ Error testing hierarchical band access:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testHierarchicalBandAccess()
