import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkMultiplePlanBands() {
  console.log('=== CHECKING FOR MULTIPLE PLANBAND RECORDS ===\n')
  
  // Find Fatima's plan
  const fatima = await prisma.principalAccount.findFirst({
    where: { first_name: { contains: 'Fatima' } },
    include: { plan: true }
  })
  
  // Find Nyanya
  const nyanya = await prisma.provider.findFirst({
    where: { facility_name: { contains: 'Nyanya' } }
  })
  
  // Check ALL PlanBand records for Basic Health Plan + Nyanya
  const basicPlanBands = await prisma.planBand.findMany({
    where: {
      plan_id: fatima?.plan_id,
      provider_id: nyanya?.id
    },
    include: { plan: true }
  })
  
  console.log('📋 ALL PLANBAND RECORDS FOR BASIC HEALTH PLAN + NYANYA:')
  console.log('   Count:', basicPlanBands.length)
  basicPlanBands.forEach((pb, index) => {
    console.log(`   ${index + 1}. Band: ${pb.band_type} | Status: ${pb.status} | Created: ${pb.created_at}`)
  })
  
  if (basicPlanBands.length > 1) {
    console.log('\n⚠️  MULTIPLE RECORDS FOUND!')
    console.log('   This could cause confusion in band validation')
    console.log('   The system might be using the wrong record')
  }
  
  // Check if there's a Band A record
  const bandARecord = basicPlanBands.find(pb => pb.band_type === 'Band A')
  if (bandARecord) {
    console.log('\n✅ BAND A RECORD FOUND:')
    console.log('   Band:', bandARecord.band_type)
    console.log('   Status:', bandARecord.status)
    console.log('   This should be the one used for validation')
  }
  
  // Check if there's a Band C record
  const bandCRecord = basicPlanBands.find(pb => pb.band_type === 'Band C')
  if (bandCRecord) {
    console.log('\n✅ BAND C RECORD FOUND:')
    console.log('   Band:', bandCRecord.band_type)
    console.log('   Status:', bandCRecord.status)
    console.log('   This is currently being used (wrong!)')
  }
  
  console.log('\n🔧 RECOMMENDED FIX:')
  if (bandARecord && bandCRecord) {
    console.log('   1. Delete the Band C record')
    console.log('   2. Keep only the Band A record')
    console.log('   3. This will make Band C patients unable to access Nyanya')
  } else if (bandCRecord && !bandARecord) {
    console.log('   1. Update the Band C record to Band A')
    console.log('   2. This will make Nyanya serve Band A for Basic Health Plan')
  }
  
  await prisma.$disconnect()
}

checkMultiplePlanBands().catch(console.error)
