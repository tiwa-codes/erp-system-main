// Create a Band C enrollee for testing hierarchical restrictions
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function createBandCEnrollee() {
  console.log('🔧 Creating Band C Enrollee for Testing...\n')

  try {
    // First, create a Band C plan
    const bandCPlan = await prisma.plan.create({
      data: {
        plan_id: `TEST-BAND-C-${Date.now()}`,
        name: 'Test Band C Plan',
        description: 'Test plan for Band C enrollees',
        assigned_bands: ['C'],
        band_type: 'Band C',
        status: 'ACTIVE',
        plan_type: 'INDIVIDUAL',
        premium_amount: 1000.00,
        annual_limit: 50000.00,
        created_by_id: 'cmh0o36wf080qiuwnu9xfmaao'
      }
    })

    console.log(`✅ Created Band C Plan: ${bandCPlan.name}`)
    console.log(`   Assigned Bands: ${bandCPlan.assigned_bands?.join(', ')}`)
    console.log(`   Band Type: ${bandCPlan.band_type}`)

    // Create a Band C enrollee
    const bandCEnrollee = await prisma.principalAccount.create({
      data: {
        enrollee_id: 'TEST-BAND-C-001',
        first_name: 'Test',
        last_name: 'BandCUser',
        email: 'testbandc@example.com',
        phone_number: '+2341234567890',
        date_of_birth: new Date('1990-01-01'),
        gender: 'MALE',
        residential_address: 'Test Address',
        region: 'Test Region',
        plan_id: bandCPlan.id,
        account_type: 'PRINCIPAL',
        organization_id: 'cmgdwzf3y01a09f08hlqdhxwv',
        created_by_id: 'cmh0o36wf080qiuwnu9xfmaao'
      }
    })

    console.log(`✅ Created Band C Enrollee: ${bandCEnrollee.first_name} ${bandCEnrollee.last_name}`)
    console.log(`   Enrollee ID: ${bandCEnrollee.enrollee_id}`)
    console.log(`   Plan: ${bandCPlan.name}`)

    // Now test the hierarchical access
    console.log(`\n🧪 Testing Hierarchical Access with Band C Enrollee:`)

    // Find Nyanya General Hospital
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

    if (nyanyaProvider) {
      console.log(`   Provider: ${nyanyaProvider.facility_name}`)
      console.log(`   Provider Bands: ${nyanyaProvider.plan_bands.map(pb => `${pb.plan.name}: ${pb.band_type}`).join(', ')}`)

      // Test hierarchical access logic
      const enrolleeBands = bandCPlan.assigned_bands || []
      const providerBands = nyanyaProvider.plan_bands.map(pb => pb.band_type)

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
      console.log('❌ Could not find Nyanya provider')
    }

  } catch (error) {
    console.error('❌ Error creating Band C enrollee:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createBandCEnrollee()
