// Script to fix data inconsistency in enrollee band assignments
const { PrismaClient, Prisma } = require('@prisma/client')

const prisma = new PrismaClient()

async function fixEnrolleeBandInconsistency() {
  console.log('🔧 Fixing Enrollee Band Data Inconsistency...\n')

  try {
    // Find all enrollees with plans to check for inconsistencies
    const allEnrollees = await prisma.principalAccount.findMany({
      where: {
        plan: {
          isNot: null
        }
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            assigned_bands: true,
            band_type: true
          }
        }
      }
    })

    console.log(`📊 Checking ${allEnrollees.length} enrollees for band inconsistencies:`)

    const inconsistentEnrollees = []

    for (const enrollee of allEnrollees) {
      const assignedBands = enrollee.plan?.assigned_bands || []
      const bandType = enrollee.plan?.band_type
      
      console.log(`\n👤 ${enrollee.first_name} ${enrollee.last_name}`)
      console.log(`   Plan: ${enrollee.plan?.name}`)
      console.log(`   Assigned Bands: ${assignedBands.join(', ') || 'None'}`)
      console.log(`   Band Type: ${bandType || 'None'}`)

      // Check if there's an inconsistency
      const hasInconsistency = assignedBands.length > 0 && bandType && 
        !assignedBands.some(band => 
          band.toLowerCase().includes(bandType.toLowerCase().replace('band ', '')) ||
          bandType.toLowerCase().includes(band.toLowerCase())
        )

      if (hasInconsistency) {
        console.log(`   ⚠️  INCONSISTENCY DETECTED!`)
        inconsistentEnrollees.push(enrollee)
        
        // Fix the inconsistency by updating assigned_bands to match band_type
        const correctedBands = [bandType]
        
        console.log(`   🔧 Fixing: Setting assigned_bands to [${correctedBands.join(', ')}]`)
        
        await prisma.plan.update({
          where: { id: enrollee.plan.id },
          data: {
            assigned_bands: correctedBands
          }
        })
        
        console.log(`   ✅ Fixed!`)
      } else {
        console.log(`   ✅ No inconsistency`)
      }
    }

    // Also check for enrollees with only band_type but no assigned_bands
    const bandTypeOnlyEnrollees = await prisma.principalAccount.findMany({
      where: {
        plan: {
          assigned_bands: null,
          band_type: { not: null }
        }
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            assigned_bands: true,
            band_type: true
          }
        }
      }
    })

    console.log(`\n📊 Found ${bandTypeOnlyEnrollees.length} enrollees with only band_type (no assigned_bands):`)

    for (const enrollee of bandTypeOnlyEnrollees) {
      const bandType = enrollee.plan?.band_type
      
      console.log(`\n👤 ${enrollee.first_name} ${enrollee.last_name}`)
      console.log(`   Plan: ${enrollee.plan?.name}`)
      console.log(`   Band Type: ${bandType}`)
      
      // Set assigned_bands to match band_type
      const assignedBands = [bandType]
      
      console.log(`   🔧 Setting assigned_bands to [${assignedBands.join(', ')}]`)
      
      await prisma.plan.update({
        where: { id: enrollee.plan.id },
        data: {
          assigned_bands: assignedBands
        }
      })
      
      console.log(`   ✅ Fixed!`)
    }

    console.log('\n🎯 Summary:')
    console.log('• Fixed enrollees with inconsistent assigned_bands vs band_type')
    console.log('• Set assigned_bands for enrollees that only had band_type')
    console.log('• All enrollees now have consistent band assignments')

  } catch (error) {
    console.error('❌ Error fixing band inconsistency:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixEnrolleeBandInconsistency()
