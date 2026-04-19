const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testBandCAccessToBandCProvider() {
  try {
    console.log('🧪 Testing Band C Enrollee Access to Band C Provider...\n')

    // Find Fatima (Band C enrollee)
    const fatima = await prisma.principalAccount.findFirst({
      where: { enrollee_id: 'CJH/CJ/003' },
      include: { plan: true }
    })

    console.log('👤 Fatima (Band C):', fatima.enrollee_id, '- Plan:', fatima.plan?.name, '- Bands:', fatima.plan?.assigned_bands)

    // Find a Band C provider for Basic Health Plan
    const bandCProvider = await prisma.provider.findFirst({
      where: {
        plan_bands: {
          some: {
            plan_id: fatima.plan_id,
            band_type: 'Band C',
            status: 'ACTIVE'
          }
        }
      }
    })

    if (!bandCProvider) {
      console.log('❌ No Band C provider found for Basic Health Plan')
      return
    }

    console.log('🏥 Band C Provider:', bandCProvider.facility_name, '- Bands:', bandCProvider.selected_bands)

    // Generate encounter code
    const encounterCode = `ENC${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
    
    const approvalCodeRecord = await prisma.approvalCode.create({
      data: {
        approval_code: encounterCode,
        enrollee_id: fatima.id,
        enrollee_name: `${fatima.first_name} ${fatima.last_name}`,
        hospital: bandCProvider.facility_name,
        services: 'Test Services',
        amount: 0,
        diagnosis: 'Test Diagnosis',
        admission_required: false,
        status: 'PENDING',
        generated_by_id: (await prisma.user.findFirst()).id
      }
    })

    console.log('✅ Encounter code generated:', encounterCode)

    // Test verification logic
    const enrolleePlan = await prisma.plan.findUnique({
      where: { id: fatima.plan_id },
      select: {
        id: true,
        name: true,
        assigned_bands: true,
        band_type: true
      }
    })

    const enrolleeBands = enrolleePlan?.assigned_bands && enrolleePlan.assigned_bands.length > 0 
      ? enrolleePlan.assigned_bands 
      : (enrolleePlan?.band_type ? [enrolleePlan.band_type] : ["Band A"])

    console.log('🎯 Enrollee Bands:', enrolleeBands)

    const planBands = await prisma.planBand.findMany({
      where: {
        plan_id: fatima.plan_id,
        provider_id: bandCProvider.id,
        status: 'ACTIVE'
      }
    })

    console.log('📋 Plan Bands Found:', planBands.length)
    if (planBands.length > 0) {
      console.log('   Provider Bands:', planBands.map(pb => pb.band_type))
    }

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

    let providerBands = []
    let isBandMatch = false

    if (planBands.length === 0) {
      providerBands = ["Band A", "Band B", "Band C"]
    } else {
      providerBands = planBands.map(pb => pb.band_type)
    }

    console.log('\n🔍 Band Validation Debug:')
    console.log('   Enrollee bands (raw):', enrolleeBands)
    console.log('   Provider bands (raw):', providerBands)
    
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
      console.log('✅ SUCCESS: Band validation passed - Band C enrollee can access Band C provider!')
      console.log('✅ API would return 200 Success')
    } else {
      console.log('❌ FAILURE: Band validation failed - This should not happen!')
      console.log('❌ API would return 403 Forbidden')
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

testBandCAccessToBandCProvider()
