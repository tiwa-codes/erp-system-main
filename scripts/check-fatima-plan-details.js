import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkFatimaPlanDetails() {
  console.log('=== CHECKING FATIMA\'S PLAN DETAILS ===\n')
  
  // Get Fatima's plan details
  const fatima = await prisma.principalAccount.findFirst({
    where: { first_name: { contains: 'Fatima' } },
    include: { 
      plan: {
        include: {
          planBands: {
            include: {
              provider: true
            }
          }
        }
      }
    }
  })
  
  if (fatima) {
    console.log('👤 FATIMA YUSUF DETAILS:')
    console.log('   Name:', fatima.first_name, fatima.last_name)
    console.log('   Plan ID:', fatima.plan_id)
    console.log('   Plan Name:', fatima.plan?.name)
    console.log('   Assigned Bands:', fatima.plan?.assigned_bands)
    console.log('   Band Type:', fatima.plan?.band_type)
    
    console.log('\n📋 PLANBAND RECORDS FOR BASIC HEALTH PLAN:')
    fatima.plan?.planBands.forEach((pb, index) => {
      console.log(`   ${index + 1}. Provider: ${pb.provider.facility_name} | Band: ${pb.band_type} | Status: ${pb.status}`)
    })
    
    // Check for Band A providers
    const bandAProviders = fatima.plan?.planBands.filter(pb => pb.band_type === 'Band A')
    if (bandAProviders && bandAProviders.length > 0) {
      console.log('\n❌ BAND A PROVIDERS FOUND:')
      bandAProviders.forEach(pb => {
        console.log(`   - ${pb.provider.facility_name} (${pb.band_type})`)
      })
    } else {
      console.log('\n✅ NO Band A providers found for Basic Health Plan')
    }
  }
  
  await prisma.$disconnect()
}

checkFatimaPlanDetails().catch(console.error)
