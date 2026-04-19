import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function investigateBanding() {
  console.log('=== INVESTIGATING BANDING ISSUE ===\n')

  try {
    // 1. Check existing plans and their bands
    console.log('1. CHECKING PLANS AND THEIR BANDS:')
    const plans = await prisma.plan.findMany({
      select: {
        id: true,
        name: true,
        assigned_bands: true,
        band_type: true
      }
    })
    
    console.log('Plans found:', plans.length)
    plans.forEach(plan => {
      console.log(`- Plan: ${plan.name}`)
      console.log(`  ID: ${plan.id}`)
      console.log(`  Assigned Bands: ${JSON.stringify(plan.assigned_bands)}`)
      console.log(`  Band Type: ${plan.band_type}`)
      console.log('')
    })

    // 2. Check existing providers
    console.log('2. CHECKING PROVIDERS:')
    const providers = await prisma.provider.findMany({
      select: {
        id: true,
        facility_name: true,
        facility_type: true,
        status: true
      },
      take: 5
    })
    
    console.log('Providers found:', providers.length)
    providers.forEach(provider => {
      console.log(`- Provider: ${provider.facility_name}`)
      console.log(`  ID: ${provider.id}`)
      console.log(`  Type: ${provider.facility_type}`)
      console.log(`  Status: ${provider.status}`)
      console.log('')
    })

    // 3. Check PlanBand records
    console.log('3. CHECKING PLAN BAND RECORDS:')
    const planBands = await prisma.planBand.findMany({
      include: {
        plan: {
          select: {
            name: true
          }
        },
        provider: {
          select: {
            facility_name: true
          }
        }
      }
    })
    
    console.log('PlanBand records found:', planBands.length)
    planBands.forEach(pb => {
      console.log(`- Plan: ${pb.plan.name}`)
      console.log(`  Provider: ${pb.provider.facility_name}`)
      console.log(`  Band Type: ${pb.band_type}`)
      console.log(`  Status: ${pb.status}`)
      console.log('')
    })

    // 4. Check enrollees and their plans
    console.log('4. CHECKING ENROLLEES AND THEIR PLANS:')
    const enrollees = await prisma.principalAccount.findMany({
      include: {
        plan: {
          select: {
            name: true,
            assigned_bands: true,
            band_type: true
          }
        }
      },
      take: 5
    })
    
    console.log('Enrollees found:', enrollees.length)
    enrollees.forEach(enrollee => {
      console.log(`- Enrollee: ${enrollee.first_name} ${enrollee.last_name}`)
      console.log(`  ID: ${enrollee.enrollee_id}`)
      console.log(`  Plan: ${enrollee.plan?.name || 'No plan'}`)
      console.log(`  Plan Bands: ${JSON.stringify(enrollee.plan?.assigned_bands)}`)
      console.log(`  Plan Band Type: ${enrollee.plan?.band_type}`)
      console.log('')
    })

    // 5. Test band validation logic
    console.log('5. TESTING BAND VALIDATION LOGIC:')
    
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

    // Test scenarios
    const testScenarios = [
      { enrolleeBand: 'Band A', providerBands: ['Band A'] },
      { enrolleeBand: 'Band A', providerBands: ['Band B'] },
      { enrolleeBand: 'Band A', providerBands: ['Band C'] },
      { enrolleeBand: 'Band B', providerBands: ['Band A'] },
      { enrolleeBand: 'Band B', providerBands: ['Band B'] },
      { enrolleeBand: 'Band B', providerBands: ['Band C'] },
      { enrolleeBand: 'Band C', providerBands: ['Band A'] },
      { enrolleeBand: 'Band C', providerBands: ['Band B'] },
      { enrolleeBand: 'Band C', providerBands: ['Band C'] },
    ]

    testScenarios.forEach(scenario => {
      const accessibleBands = getAccessibleBands(scenario.enrolleeBand)
      const hasMatch = accessibleBands.some(accessibleBand => {
        const normalizedAccessible = normalizeBand(accessibleBand)
        return scenario.providerBands.some(providerBand => {
          const normalizedProvider = normalizeBand(providerBand)
          return normalizedProvider === normalizedAccessible
        })
      })
      
      console.log(`Enrollee Band: ${scenario.enrolleeBand} | Provider Bands: ${scenario.providerBands.join(', ')} | Accessible: ${accessibleBands.join(', ')} | Match: ${hasMatch}`)
    })

  } catch (error) {
    console.error('Error investigating banding:', error)
  } finally {
    await prisma.$disconnect()
  }
}

investigateBanding()
