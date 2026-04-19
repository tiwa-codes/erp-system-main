import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDataInconsistency() {
  console.log('=== CHECKING FOR DATA INCONSISTENCY ===\n')
  
  // Check Fatima's plan details
  const fatima = await prisma.principalAccount.findFirst({
    where: { first_name: { contains: 'Fatima' } },
    include: { plan: true }
  })
  
  if (fatima) {
    console.log('👤 FATIMA\'S PLAN DATA:')
    console.log('   Plan Name:', fatima.plan?.name)
    console.log('   Assigned Bands:', fatima.plan?.assigned_bands)
    console.log('   Band Type:', fatima.plan?.band_type)
    console.log('   ⚠️  CONFLICT: assigned_bands=[C] but band_type=Band A')
    console.log('   📝 The system uses assigned_bands=[C] (Band C)')
  }
  
  // Check if there are other patients under Basic Health Plan
  const basicPlanPatients = await prisma.principalAccount.findMany({
    where: { plan_id: fatima?.plan_id },
    select: {
      first_name: true,
      last_name: true,
      enrollee_id: true
    }
  })
  
  console.log('\n👥 OTHER PATIENTS UNDER BASIC HEALTH PLAN:')
  basicPlanPatients.forEach((patient, index) => {
    console.log(`   ${index + 1}. ${patient.first_name} ${patient.last_name} (${patient.enrollee_id})`)
  })
  
  // Check if there are Band A providers for Basic Health Plan
  const bandAProviders = await prisma.planBand.findMany({
    where: {
      plan_id: fatima?.plan_id,
      band_type: 'Band A',
      status: 'ACTIVE'
    },
    include: {
      provider: true
    }
  })
  
  console.log('\n🏥 BAND A PROVIDERS FOR BASIC HEALTH PLAN:')
  if (bandAProviders.length > 0) {
    bandAProviders.forEach((pb, index) => {
      console.log(`   ${index + 1}. ${pb.provider.facility_name} (${pb.band_type})`)
    })
  } else {
    console.log('   ❌ NO Band A providers found for Basic Health Plan')
  }
  
  console.log('\n🤔 QUESTION FOR CLARIFICATION:')
  console.log('   Should Fatima (Band C) be able to access Nyanya (Band C)?')
  console.log('   OR should Fatima be Band A to access Nyanya Band A?')
  console.log('   OR should Nyanya be Band A for Basic Health Plan?')
  
  await prisma.$disconnect()
}

checkDataInconsistency().catch(console.error)
