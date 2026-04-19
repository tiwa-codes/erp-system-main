const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testBandAAccess() {
  try {
    console.log('🧪 Testing Band A Enrollee Access...\n')

    // Find a Band A enrollee
    const bandAEnrollee = await prisma.principalAccount.findFirst({
      where: {
        plan: {
          OR: [
            { assigned_bands: { has: 'A' } },
            { band_type: 'Band A' }
          ]
        }
      },
      include: {
        plan: true,
        organization: true
      }
    })

    if (!bandAEnrollee) {
      console.log('❌ No Band A enrollee found')
      return
    }

    console.log('👤 Band A Enrollee Details:')
    console.log('   Enrollee ID:', bandAEnrollee.enrollee_id)
    console.log('   Plan:', bandAEnrollee.plan?.name)
    console.log('   Assigned Bands:', bandAEnrollee.plan?.assigned_bands)
    console.log('   Band Type:', bandAEnrollee.plan?.band_type)

    // Find Nyanya (Band A provider)
    const nyanya = await prisma.provider.findFirst({
      where: { facility_name: { contains: 'Nyanya', mode: 'insensitive' } }
    })

    console.log('\n🏥 Nyanya Details:')
    console.log('   Facility Name:', nyanya.facility_name)
    console.log('   Selected Bands:', nyanya.selected_bands)

    // Test the hierarchical access
    const enrolleeBands = bandAEnrollee.plan?.assigned_bands && bandAEnrollee.plan.assigned_bands.length > 0 
      ? bandAEnrollee.plan.assigned_bands 
      : (bandAEnrollee.plan?.band_type ? [bandAEnrollee.plan.band_type] : ["Band A"])

    console.log('\n🎯 Enrollee Bands:', enrolleeBands)

    // Helper function to get accessible bands based on hierarchical access
    const getAccessibleBands = (enrolleeBand) => {
      const band = enrolleeBand.toLowerCase().trim()
      
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
          return [enrolleeBand] // Default to same band
      }
    }

    // Check accessible bands for each enrollee band
    enrolleeBands.forEach(enrolleeBand => {
      const accessibleBands = getAccessibleBands(enrolleeBand)
      console.log(`   Enrollee band "${enrolleeBand}" can access:`, accessibleBands)
    })

    // Check if Nyanya is accessible
    const nyanyaBands = nyanya.selected_bands || []
    console.log('\n🔍 Checking Nyanya Access:')
    console.log('   Nyanya Bands:', nyanyaBands)

    const hasAccess = enrolleeBands.some(enrolleeBand => {
      const accessibleBands = getAccessibleBands(enrolleeBand)
      return accessibleBands.some(accessibleBand => {
        const normalizedAccessible = accessibleBand.toLowerCase().trim()
        return nyanyaBands.some(nyanyaBand => {
          const normalizedNyanya = nyanyaBand.toLowerCase().trim()
          return normalizedNyanya === normalizedAccessible || 
                 (normalizedAccessible === 'band a' && normalizedNyanya === 'a') ||
                 (normalizedAccessible === 'band b' && normalizedNyanya === 'b') ||
                 (normalizedAccessible === 'band c' && normalizedNyanya === 'c')
        })
      })
    })

    console.log('\n🎯 Access Result:', hasAccess ? '✅ ALLOWED' : '❌ DENIED')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testBandAAccess()
