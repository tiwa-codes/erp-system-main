// Check what Band C enrollees exist
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkBandCEnrollees() {
  console.log('🔍 Checking Band C Enrollees...\n')

  try {
    // Find enrollees with Band C
    const bandCEnrollees = await prisma.principalAccount.findMany({
      where: {
        plan: {
          assigned_bands: { has: 'C' }
        }
      },
      include: {
        plan: {
          select: {
            name: true,
            assigned_bands: true,
            band_type: true
          }
        }
      }
    })

    console.log(`📊 Found ${bandCEnrollees.length} enrollees with Band C:`)
    
    for (const enrollee of bandCEnrollees) {
      console.log(`\n👤 ${enrollee.first_name} ${enrollee.last_name}`)
      console.log(`   Plan: ${enrollee.plan?.name}`)
      console.log(`   Assigned Bands: ${enrollee.plan?.assigned_bands?.join(', ')}`)
      console.log(`   Band Type: ${enrollee.plan?.band_type}`)
    }

    // Also check for enrollees with 'Band C' (with space)
    const bandCWithSpaceEnrollees = await prisma.principalAccount.findMany({
      where: {
        plan: {
          assigned_bands: { has: 'Band C' }
        }
      },
      include: {
        plan: {
          select: {
            name: true,
            assigned_bands: true,
            band_type: true
          }
        }
      }
    })

    console.log(`\n📊 Found ${bandCWithSpaceEnrollees.length} enrollees with 'Band C' (with space):`)
    
    for (const enrollee of bandCWithSpaceEnrollees) {
      console.log(`\n👤 ${enrollee.first_name} ${enrollee.last_name}`)
      console.log(`   Plan: ${enrollee.plan?.name}`)
      console.log(`   Assigned Bands: ${enrollee.plan?.assigned_bands?.join(', ')}`)
      console.log(`   Band Type: ${enrollee.plan?.band_type}`)
    }

    // Check all unique assigned_bands values
    const allPlans = await prisma.plan.findMany({
      select: {
        name: true,
        assigned_bands: true,
        band_type: true
      }
    })

    console.log(`\n📊 All unique assigned_bands values:`)
    const uniqueBands = new Set()
    for (const plan of allPlans) {
      if (plan.assigned_bands) {
        for (const band of plan.assigned_bands) {
          uniqueBands.add(band)
        }
      }
    }
    
    console.log(`   Unique bands: ${Array.from(uniqueBands).join(', ')}`)

  } catch (error) {
    console.error('❌ Error checking Band C enrollees:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkBandCEnrollees()
