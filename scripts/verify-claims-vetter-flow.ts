import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyClaimsVetterFlow() {
  try {
    console.log('🔍 Verifying Claims to Vetter Flow...\n')
    
    // 1. Check for NEW claims (ready to be requested)
    console.log('📊 Step 1: Claims with NEW status (Ready for Provider Request)')
    const newClaims = await prisma.claim.findMany({
      where: { status: 'NEW' },
      take: 5,
      select: {
        id: true,
        claim_number: true,
        status: true,
        current_stage: true,
        amount: true,
        provider: {
          select: { facility_name: true }
        },
        principal: {
          select: { first_name: true, last_name: true, enrollee_id: true }
        }
      }
    })
    
    console.log(`Found ${newClaims.length} NEW claims`)
    newClaims.forEach((claim, index) => {
      console.log(`  ${index + 1}. ${claim.claim_number}`)
      console.log(`     Status: ${claim.status} | Stage: ${claim.current_stage || 'Not set'}`)
      console.log(`     Provider: ${claim.provider.facility_name}`)
      console.log(`     Enrollee: ${claim.principal.first_name} ${claim.principal.last_name}`)
      console.log()
    })

    // 2. Check for PENDING claims (submitted to vetter)
    console.log('\n📊 Step 2: Claims with PENDING status (Sent to Vetter)')
    const pendingClaims = await prisma.claim.findMany({
      where: { 
        status: 'PENDING',
        current_stage: 'vetter1'
      },
      take: 5,
      select: {
        id: true,
        claim_number: true,
        status: true,
        current_stage: true,
        amount: true,
        provider: {
          select: { facility_name: true }
        },
        principal: {
          select: { first_name: true, last_name: true, enrollee_id: true }
        }
      }
    })
    
    console.log(`Found ${pendingClaims.length} PENDING claims in Vetter1`)
    pendingClaims.forEach((claim, index) => {
      console.log(`  ${index + 1}. ${claim.claim_number}`)
      console.log(`     Status: ${claim.status} | Stage: ${claim.current_stage}`)
      console.log(`     Provider: ${claim.provider.facility_name}`)
      console.log(`     Enrollee: ${claim.principal.first_name} ${claim.principal.last_name}`)
      console.log()
    })

    // 3. Check for PAID claims (completed)
    console.log('\n📊 Step 3: Claims with PAID status (Settled)')
    const paidClaims = await prisma.claim.findMany({
      where: { status: 'PAID' },
      take: 5,
      select: {
        id: true,
        claim_number: true,
        status: true,
        current_stage: true,
        amount: true,
        provider: {
          select: { facility_name: true }
        }
      }
    })
    
    console.log(`Found ${paidClaims.length} PAID claims`)
    paidClaims.forEach((claim, index) => {
      console.log(`  ${index + 1}. ${claim.claim_number}`)
      console.log(`     Status: ${claim.status} | Stage: ${claim.current_stage || 'Completed'}`)
      console.log(`     Provider: ${claim.provider.facility_name}`)
      console.log()
    })

    // 4. Summary by status
    console.log('\n📈 Summary: Claims Count by Status')
    const statusCounts = await prisma.claim.groupBy({
      by: ['status'],
      _count: true
    })
    
    statusCounts.forEach(stat => {
      console.log(`  ${stat.status}: ${stat._count} claims`)
    })

    // 5. Summary by stage
    console.log('\n📈 Summary: Claims Count by Stage')
    const stageCounts = await prisma.claim.groupBy({
      by: ['current_stage'],
      _count: true
    })
    
    stageCounts.forEach(stat => {
      console.log(`  ${stat.current_stage || 'No Stage'}: ${stat._count} claims`)
    })

    // 6. Check for claims that should be visible in vetter
    console.log('\n✅ Claims that SHOULD appear in Vetter1 (PENDING + vetter1 stage):')
    const vetter1Ready = await prisma.claim.count({
      where: {
        current_stage: 'vetter1',
        status: {
          in: ['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'VETTING']
        }
      }
    })
    console.log(`  ${vetter1Ready} claims are ready for Vetter1`)

    // 7. Identify potential orphaned claims
    console.log('\n⚠️  Potential Issues:')
    
    const pendingWithoutStage = await prisma.claim.count({
      where: {
        status: 'PENDING',
        current_stage: null
      }
    })
    if (pendingWithoutStage > 0) {
      console.log(`  ⚠️  ${pendingWithoutStage} PENDING claims without current_stage set`)
    }

    const newWithStage = await prisma.claim.count({
      where: {
        status: 'NEW',
        current_stage: { not: null }
      }
    })
    if (newWithStage > 0) {
      console.log(`  ⚠️  ${newWithStage} NEW claims already have current_stage set`)
    }

    console.log('\n✅ Verification Complete!')
    console.log('\n📋 Expected Flow:')
    console.log('  1. Approval Code Generated → Claim Created (status: NEW)')
    console.log('  2. Provider Requests Claim → Status becomes PENDING, current_stage = vetter1')
    console.log('  3. Vetter1 Processes → Status may change to UNDER_REVIEW/VETTING')
    console.log('  4. Finance Settles → Status becomes PAID')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyClaimsVetterFlow()
