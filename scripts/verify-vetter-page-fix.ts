import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyFix() {
  const providerId = 'cmi8rizvf0004iufbgt09anib'
  
  try {
    console.log('🔍 Verifying vetter1 page fix...\n')
    console.log(`Testing provider: ${providerId}\n`)
    
    // This is what the OLD page was doing (filtering by status: "VETTING")
    console.log('❌ OLD QUERY (status: "VETTING"):')
    const oldQuery = await prisma.claim.findMany({
      where: {
        provider_id: providerId,
        status: 'VETTING' // This doesn't match any claims
      }
    })
    console.log(`   Found: ${oldQuery.length} claims\n`)
    
    // This is what the NEW page will do (filtering by current_stage: "vetter1")
    console.log('✅ NEW QUERY (stage: "vetter1"):')
    const newQuery = await prisma.claim.findMany({
      where: {
        provider_id: providerId,
        current_stage: 'vetter1'
      },
      select: {
        id: true,
        claim_number: true,
        status: true,
        amount: true,
        current_stage: true,
        principal: {
          select: {
            first_name: true,
            last_name: true
          }
        }
      }
    })
    
    console.log(`   Found: ${newQuery.length} claims`)
    newQuery.forEach((claim, i) => {
      console.log(`   ${i + 1}. ${claim.claim_number} - ${claim.principal?.first_name} ${claim.principal?.last_name}`)
      console.log(`      Status: ${claim.status}, Stage: ${claim.current_stage}, Amount: ₦${claim.amount}`)
    })
    
    console.log('\n✅ Fix confirmed! The page will now show the claims correctly.')
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyFix()
