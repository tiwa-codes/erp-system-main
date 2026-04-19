import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testAPIEndpoints() {
  console.log('=== TESTING API ENDPOINTS WITH CORRECTED DATA ===\n')

  try {
    // Test 1: Generate approval code for Band B enrollee accessing Band B provider
    console.log('1. Testing approval code generation...')
    
    const enrollee = await prisma.principalAccount.findFirst({
      where: { enrollee_id: 'CJH/CJ/001' }, // Yusuf Yusuf - Band B
      include: {
        plan: true,
        organization: true
      }
    })

    const provider = await prisma.provider.findFirst({
      where: { facility_name: { contains: 'City General Hospital', mode: "insensitive" } }
    })

    if (enrollee && provider) {
      console.log(`Enrollee: ${enrollee.first_name} ${enrollee.last_name} (${enrollee.enrollee_id})`)
      console.log(`Plan: ${enrollee.plan.name}`)
      console.log(`Plan Bands: ${JSON.stringify(enrollee.plan.assigned_bands)}`)
      console.log(`Provider: ${provider.facility_name}`)
      
      // Check PlanBand records
      const planBands = await prisma.planBand.findMany({
        where: {
          plan_id: enrollee.plan_id,
          provider_id: provider.id,
          status: 'ACTIVE'
        }
      })
      
      console.log(`Provider Bands: ${planBands.map(pb => pb.band_type).join(', ')}`)
      
      // Test the band validation logic
      const enrolleeBands = enrollee.plan.assigned_bands && enrollee.plan.assigned_bands.length > 0 
        ? enrollee.plan.assigned_bands.map(b => `Band ${b.toUpperCase()}`)
        : (enrollee.plan.band_type ? [enrollee.plan.band_type] : ["Band A"])

      const providerBands = planBands.map(pb => pb.band_type)

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

      const isBandMatch = enrolleeBands.some(enrolleeBand => {
        const accessibleBands = getAccessibleBands(enrolleeBand)
        return accessibleBands.some(accessibleBand => {
          const normalizedAccessible = normalizeBand(accessibleBand)
          return providerBands.some(providerBand => {
            const normalizedProvider = normalizeBand(providerBand)
            return normalizedProvider === normalizedAccessible
          })
        })
      })

      console.log(`Band validation result: ${isBandMatch ? '✅ PASS' : '❌ FAIL'}`)
      
      if (isBandMatch) {
        console.log('✅ This enrollee should be able to generate approval codes for this provider')
      } else {
        console.log('❌ This enrollee should NOT be able to generate approval codes for this provider')
      }
    }

    // Test 2: Test encounter code verification
    console.log('\n2. Testing encounter code verification...')
    
    // First, create a test approval code
    const testApprovalCode = await prisma.approvalCode.create({
      data: {
        approval_code: 'TEST123456',
        enrollee_id: enrollee.id,
        enrollee_name: `${enrollee.first_name} ${enrollee.last_name}`,
        hospital: provider.facility_name,
        services: 'Test Service',
        amount: 1000,
        diagnosis: 'Test Diagnosis',
        admission_required: false,
        status: 'PENDING',
        generated_by_id: enrollee.id // Using enrollee ID as fallback
      }
    })

    console.log(`Created test approval code: ${testApprovalCode.approval_code}`)
    console.log(`Status: ${testApprovalCode.status}`)

    // Test the encounter verification logic
    const approvalCode = await prisma.approvalCode.findFirst({
      where: {
        approval_code: 'TEST123456',
        status: 'PENDING'
      },
      include: {
        enrollee: {
          include: {
            organization: true,
            plan: true
          }
        }
      }
    })

    if (approvalCode) {
      console.log(`Found approval code for enrollee: ${approvalCode.enrollee.first_name} ${approvalCode.enrollee.last_name}`)
      
      // Test band validation for encounter verification
      const enrolleePlan = approvalCode.enrollee.plan
      const enrolleeBands = enrolleePlan.assigned_bands && enrolleePlan.assigned_bands.length > 0 
        ? enrolleePlan.assigned_bands.map(b => `Band ${b.toUpperCase()}`)
        : (enrolleePlan.band_type ? [enrolleePlan.band_type] : ["Band A"])

      const planBands = await prisma.planBand.findMany({
        where: {
          plan_id: approvalCode.enrollee.plan_id,
          provider_id: provider.id,
          status: 'ACTIVE'
        }
      })

      const providerBands = planBands.map(pb => pb.band_type)

      const isBandMatch = enrolleeBands.some(enrolleeBand => {
        const accessibleBands = getAccessibleBands(enrolleeBand)
        return accessibleBands.some(accessibleBand => {
          const normalizedAccessible = normalizeBand(accessibleBand)
          return providerBands.some(providerBand => {
            const normalizedProvider = normalizeBand(providerBand)
            return normalizedProvider === normalizedAccessible
          })
        })
      })

      console.log(`Encounter verification band validation: ${isBandMatch ? '✅ PASS' : '❌ FAIL'}`)
      
      if (isBandMatch) {
        console.log('✅ This encounter code should be verifiable for this provider')
      } else {
        console.log('❌ This encounter code should NOT be verifiable for this provider')
      }
    }

    // Clean up test data
    await prisma.approvalCode.delete({
      where: { id: testApprovalCode.id }
    })
    console.log('Cleaned up test approval code')

  } catch (error) {
    console.error('Error testing API endpoints:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testAPIEndpoints()
