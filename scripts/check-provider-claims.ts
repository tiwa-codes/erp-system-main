import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkProviderClaims() {
  const providerId = 'cmi8rizvf0004iufbgt09anib'
  
  try {
    console.log(`🔍 Checking provider: ${providerId}\n`)
    
    // Check if provider exists
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      select: {
        id: true,
        facility_name: true,
        facility_type: true,
        _count: {
          select: {
            claims: true
          }
        }
      }
    })
    
    if (!provider) {
      console.log('❌ Provider not found!')
      return
    }
    
    console.log(`✅ Provider found: ${provider.facility_name}`)
    console.log(`   Type: ${provider.facility_type}`)
    console.log(`   Total claims: ${provider._count.claims}\n`)
    
    // Get all claims for this provider
    const allClaims = await prisma.claim.findMany({
      where: { provider_id: providerId },
      orderBy: { created_at: 'desc' },
      take: 20,
      select: {
        id: true,
        claim_number: true,
        status: true,
        amount: true,
        current_stage: true,
        created_at: true,
        principal: {
          select: {
            first_name: true,
            last_name: true,
            enrollee_id: true
          }
        }
      }
    })
    
    console.log(`📋 Claims for this provider (${allClaims.length}):`)
    if (allClaims.length === 0) {
      console.log('   No claims found!')
    } else {
      allClaims.forEach((claim, index) => {
        console.log(`\n${index + 1}. ${claim.claim_number}`)
        console.log(`   Status: ${claim.status}`)
        console.log(`   Stage: ${claim.current_stage || 'N/A'}`)
        console.log(`   Amount: ₦${claim.amount}`)
        console.log(`   Patient: ${claim.principal?.first_name} ${claim.principal?.last_name}`)
        console.log(`   Created: ${claim.created_at}`)
      })
    }
    
    // Group by status
    console.log('\n📊 Claims by status:')
    const byStatus = await prisma.claim.groupBy({
      by: ['status'],
      where: { provider_id: providerId },
      _count: true
    })
    
    byStatus.forEach(group => {
      console.log(`   ${group.status}: ${group._count}`)
    })
    
    // Check for claims in PENDING status (what we just fixed)
    const pendingClaims = await prisma.claim.count({
      where: {
        provider_id: providerId,
        status: 'PENDING'
      }
    })
    
    console.log(`\n🔍 PENDING claims (should show in vetter): ${pendingClaims}`)
    
    // Check for claims in vetter stages
    const vetter1Claims = await prisma.claim.count({
      where: {
        provider_id: providerId,
        current_stage: 'vetter1'
      }
    })
    
    const vetter2Claims = await prisma.claim.count({
      where: {
        provider_id: providerId,
        current_stage: 'vetter2'
      }
    })
    
    console.log(`\n📍 Claims by stage:`)
    console.log(`   Vetter1: ${vetter1Claims}`)
    console.log(`   Vetter2: ${vetter2Claims}`)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkProviderClaims()
