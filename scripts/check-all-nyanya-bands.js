import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAllNyanyaBands() {
  console.log('=== CHECKING ALL NYANYA BANDS ===\n')
  
  // Get all PlanBand records for Nyanya
  const nyanyaBands = await prisma.planBand.findMany({
    where: {
      provider: { facility_name: { contains: 'Nyanya' } }
    },
    include: {
      plan: true,
      provider: true
    }
  })
  
  console.log('🏥 ALL NYANYA GENERAL HOSPITAL BANDS:')
  nyanyaBands.forEach((pb, index) => {
    console.log(`   ${index + 1}. Plan: ${pb.plan.name} | Band: ${pb.band_type} | Status: ${pb.status}`)
  })
  
  // Check if there's a Band A record for Basic Health Plan
  const bandABasic = nyanyaBands.find(pb => 
    pb.plan.name === 'Basic Health Plan' && pb.band_type === 'Band A'
  )
  
  if (bandABasic) {
    console.log('\n❌ PROBLEM FOUND:')
    console.log('   There IS a Band A record for Basic Health Plan!')
    console.log('   This means Nyanya serves Band A for Basic Health Plan')
    console.log('   But Fatima (Band C) should NOT access Band A')
  } else {
    console.log('\n✅ NO Band A record found for Basic Health Plan')
    console.log('   Only Band C record exists, which should be correct')
  }
  
  await prisma.$disconnect()
}

checkAllNyanyaBands().catch(console.error)
