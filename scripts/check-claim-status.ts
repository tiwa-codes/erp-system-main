/**
 * Script to check the status of a specific claim
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkClaimStatus() {
  const claimId = 'cmh1s8jv901p5iu79h3tb21nu'
  
  try {
    console.log(`🔍 Checking claim: ${claimId}\n`)
    
    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
      include: {
        principal: {
          select: {
            enrollee_id: true,
            first_name: true,
            last_name: true
          }
        },
        provider: {
          select: {
            facility_name: true
          }
        }
      }
    })

    if (!claim) {
      console.log('❌ Claim not found')
      return
    }

    console.log('📋 Claim Details:')
    console.log('================')
    console.log(`Claim Number: ${claim.claim_number}`)
    console.log(`Status: ${claim.status}`)
    console.log(`Enrollee: ${claim.principal?.first_name} ${claim.principal?.last_name} (${claim.principal?.enrollee_id})`)
    console.log(`Provider: ${claim.provider?.facility_name}`)
    console.log(`Created: ${claim.created_at}`)
    console.log(`Updated: ${claim.updated_at}`)
    
    console.log('\n💡 Note:')
    console.log('Bulk claims processing only works for claims with status: NEW')
    console.log(`This claim has status: ${claim.status}`)
    
    if (claim.status !== 'NEW') {
      console.log('\n⚠️  This claim cannot be processed in bulk because:')
      console.log(`   - Current status is "${claim.status}"`)
      console.log('   - Only claims with status "NEW" can be sent to vetting')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkClaimStatus()
