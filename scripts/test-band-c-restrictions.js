// Test script to verify Band C enrollee restrictions
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testBandCRestrictions() {
  console.log('🧪 Testing Band C Enrollee Restrictions...\n')

  try {
    // Find a Band C enrollee (should be someone with assigned_bands: ['C'])
    const bandCEnrollee = await prisma.principalAccount.findFirst({
      where: {
        plan: {
          assigned_bands: { has: 'C' }
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

    // Find Nyanya General Hospital (Band A provider)
    const nyanyaProvider = await prisma.provider.findFirst({
      where: {
        facility_name: {
          contains: 'Nyanya',
          mode: 'insensitive'
        }
      },
      include: {
        plan_bands: {
          where: {
            status: 'ACTIVE'
          },
          include: {
            plan: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    if (bandCEnrollee && nyanyaProvider) {
      console.log(`📊 Test Data:`)
      console.log(`   Band C Enrollee: ${bandCEnrollee.first_name} ${bandCEnrollee.last_name}`)
      console.log(`   Plan: ${bandCEnrollee.plan?.name}`)
      console.log(`   Assigned Bands: ${bandCEnrollee.plan?.assigned_bands?.join(', ')}`)
      console.log(`   Band Type: ${bandCEnrollee.plan?.band_type}`)
      
      console.log(`\n   Provider: ${nyanyaProvider.facility_name}`)
      console.log(`   Provider Bands: ${nyanyaProvider.plan_bands.map(pb => `${pb.plan.name}: ${pb.band_type}`).join(', ')}`)

      // Test hierarchical access logic
      const enrolleeBands = bandCEnrollee.plan?.assigned_bands || []
      const providerBands = nyanyaProvider.plan_bands.map(pb => pb.band_type)

      console.log(`\n🔍 Testing Hierarchical Access:`)
      console.log(`   Enrollee Bands: ${enrolleeBands.join(', ')}`)
      console.log(`   Provider Bands: ${providerBands.join(', ')}`)

      // Function to get accessible bands (same as API)
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

      // Function to normalize band names
      function normalizeBand(band) {
        const normalized = band.toLowerCase().trim()
        if (normalized === 'a' || normalized === 'band a') return 'Band A'
        if (normalized === 'b' || normalized === 'band b') return 'Band B'
        if (normalized === 'c' || normalized === 'band c') return 'Band C'
        return band
      }

      // Check hierarchical access
      const isBandMatch = enrolleeBands.some(enrolleeBand => {
        const accessibleBands = getAccessibleBands(enrolleeBand)
        console.log(`   Accessible Bands for ${enrolleeBand}: ${accessibleBands.join(', ')}`)
        
        return accessibleBands.some(accessibleBand => {
          const normalizedAccessible = normalizeBand(accessibleBand)
          return providerBands.some(providerBand => {
            const normalizedProvider = normalizeBand(providerBand)
            const isMatch = normalizedProvider === normalizedAccessible
            console.log(`     Comparing "${providerBand}" (${normalizedProvider}) with "${accessibleBand}" (${normalizedAccessible}): ${isMatch}`)
            return isMatch
          })
        })
      })

      console.log(`\n🎯 Result: ${isBandMatch ? '✅ ALLOWED' : '❌ DENIED'}`)
      
      if (isBandMatch) {
        console.log('❌ ERROR: Band C enrollee should NOT be able to access Band A provider!')
      } else {
        console.log('✅ CORRECT: Band C enrollee correctly denied access to Band A provider')
      }

    } else {
      console.log('❌ Could not find Band C enrollee or Nyanya provider')
    }

  } catch (error) {
    console.error('❌ Error testing Band C restrictions:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testBandCRestrictions()
