const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkPlanBandData() {
  try {
    console.log('🔍 Checking PlanBand Data Configuration...\n')

    // Find Fatima's plan
    const fatima = await prisma.principalAccount.findFirst({
      where: { enrollee_id: 'CJH/CJ/003' },
      include: { plan: true }
    })

    if (!fatima) {
      console.log('❌ Fatima not found')
      return
    }

    console.log('👤 Fatima Details:')
    console.log('   Enrollee ID:', fatima.enrollee_id)
    console.log('   Plan:', fatima.plan?.name)
    console.log('   Assigned Bands:', fatima.plan?.assigned_bands)
    console.log('   Band Type:', fatima.plan?.band_type)

    // Find Nyanya
    const nyanya = await prisma.provider.findFirst({
      where: { facility_name: { contains: 'Nyanya', mode: 'insensitive' } }
    })

    if (!nyanya) {
      console.log('❌ Nyanya not found')
      return
    }

    console.log('\n🏥 Nyanya Details:')
    console.log('   Facility Name:', nyanya.facility_name)
    console.log('   Selected Bands:', nyanya.selected_bands)

    // Check PlanBand records for this combination
    console.log('\n📋 PlanBand Records:')
    const planBands = await prisma.planBand.findMany({
      where: {
        plan_id: fatima.plan_id,
        provider_id: nyanya.id
      },
      include: {
        plan: true,
        provider: true
      }
    })

    console.log('   Found', planBands.length, 'PlanBand records')
    planBands.forEach((pb, index) => {
      console.log(`   ${index + 1}. Plan: ${pb.plan.name}`)
      console.log(`      Provider: ${pb.provider.facility_name}`)
      console.log(`      Band Type: ${pb.band_type}`)
      console.log(`      Status: ${pb.status}`)
    })

    // Check all PlanBand records for Nyanya
    console.log('\n📋 All PlanBand Records for Nyanya:')
    const allNyanyaPlanBands = await prisma.planBand.findMany({
      where: { provider_id: nyanya.id },
      include: {
        plan: true,
        provider: true
      }
    })

    console.log('   Found', allNyanyaPlanBands.length, 'total PlanBand records for Nyanya')
    allNyanyaPlanBands.forEach((pb, index) => {
      console.log(`   ${index + 1}. Plan: ${pb.plan.name} - Band: ${pb.band_type} - Status: ${pb.status}`)
    })

    // Check all PlanBand records for Basic Health Plan
    console.log('\n📋 All PlanBand Records for Basic Health Plan:')
    const allBasicPlanBands = await prisma.planBand.findMany({
      where: { plan_id: fatima.plan_id },
      include: {
        plan: true,
        provider: true
      }
    })

    console.log('   Found', allBasicPlanBands.length, 'total PlanBand records for Basic Health Plan')
    allBasicPlanBands.forEach((pb, index) => {
      console.log(`   ${index + 1}. Provider: ${pb.provider.facility_name} - Band: ${pb.band_type} - Status: ${pb.status}`)
    })

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkPlanBandData()
