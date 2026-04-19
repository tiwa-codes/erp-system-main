const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function findTrueBandAEnrollee() {
  try {
    console.log('🔍 Finding True Band A Enrollee...\n')

    // Find enrollees with assigned_bands containing 'A'
    const bandAEnrollees = await prisma.principalAccount.findMany({
      where: {
        plan: {
          assigned_bands: { has: 'A' }
        }
      },
      include: {
        plan: true,
        organization: true
      },
      take: 5
    })

    console.log('👤 Band A Enrollees Found:', bandAEnrollees.length)
    bandAEnrollees.forEach((enrollee, index) => {
      console.log(`   ${index + 1}. ${enrollee.enrollee_id} - Plan: ${enrollee.plan?.name}`)
      console.log(`      Assigned Bands: ${enrollee.plan?.assigned_bands}`)
      console.log(`      Band Type: ${enrollee.plan?.band_type}`)
    })

    if (bandAEnrollees.length > 0) {
      const testEnrollee = bandAEnrollees[0]
      console.log('\n🧪 Testing with:', testEnrollee.enrollee_id)

      // Find Nyanya
      const nyanya = await prisma.provider.findFirst({
        where: { facility_name: { contains: 'Nyanya', mode: 'insensitive' } }
      })

      console.log('🏥 Nyanya Bands:', nyanya.selected_bands)

      // Test access
      const enrolleeBands = testEnrollee.plan?.assigned_bands || []
      console.log('🎯 Enrollee Bands:', enrolleeBands)

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

      const hasAccess = enrolleeBands.some(enrolleeBand => {
        const accessibleBands = getAccessibleBands(enrolleeBand)
        console.log(`   Band "${enrolleeBand}" can access:`, accessibleBands)
        return accessibleBands.some(accessibleBand => {
          const normalizedAccessible = accessibleBand.toLowerCase().trim()
          return nyanya.selected_bands.some(nyanyaBand => {
            const normalizedNyanya = nyanyaBand.toLowerCase().trim()
            return normalizedNyanya === normalizedAccessible || 
                   (normalizedAccessible === 'band a' && normalizedNyanya === 'a') ||
                   (normalizedAccessible === 'band b' && normalizedNyanya === 'b') ||
                   (normalizedAccessible === 'band c' && normalizedNyanya === 'c')
          })
        })
      })

      console.log('\n🎯 Access Result:', hasAccess ? '✅ ALLOWED' : '❌ DENIED')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

findTrueBandAEnrollee()
