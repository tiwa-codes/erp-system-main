import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkClaimActions() {
  const claimId = 'cmjgsn9am0045iu5oqm9auvqf'
  
  try {
    console.log(`🔍 Checking claim: ${claimId}\n`)
    
    // Get claim details
    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
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
    
    if (!claim) {
      console.log('❌ Claim not found!')
      return
    }
    
    console.log(`✅ Claim: ${claim.claim_number}`)
    console.log(`   Status: ${claim.status}`)
    console.log(`   Current Stage: ${claim.current_stage || 'null'}`)
    console.log(`   Provider: ${claim.provider?.facility_name}`)
    console.log(`   Amount: ₦${claim.amount}\n`)
    
    // Get all vetting actions
    const actions = await prisma.vettingAction.findMany({
      where: { claim_id: claimId },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        stage: true,
        action: true,
        comments: true,
        created_at: true,
        action_by: {
          select: {
            first_name: true,
            last_name: true,
            role: {
              select: { name: true }
            }
          }
        }
      }
    })
    
    console.log(`📋 Vetting Actions (${actions.length}):`)
    if (actions.length === 0) {
      console.log('   No actions taken yet')
    } else {
      actions.forEach((action, i) => {
        console.log(`\n${i + 1}. ${action.stage.toUpperCase()}`)
        console.log(`   Action: ${action.action}`)
        console.log(`   By: ${action.action_by?.first_name} ${action.action_by?.last_name} (${action.action_by?.role?.name})`)
        console.log(`   Date: ${action.created_at}`)
        if (action.comments) {
          console.log(`   Comments: ${action.comments}`)
        }
      })
    }
    
    // Check vetting records
    const vettingRecords = await prisma.vettingRecord.findMany({
      where: { claim_id: claimId },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        vetting_type: true,
        status: true,
        findings: true,
        completed_at: true,
        vetter: {
          select: {
            first_name: true,
            last_name: true
          }
        }
      }
    })
    
    console.log(`\n📝 Vetting Records (${vettingRecords.length}):`)
    if (vettingRecords.length === 0) {
      console.log('   No vetting records yet')
    } else {
      vettingRecords.forEach((record, i) => {
        console.log(`\n${i + 1}. ${record.vetting_type}`)
        console.log(`   Status: ${record.status}`)
        console.log(`   By: ${record.vetter?.first_name} ${record.vetter?.last_name}`)
        console.log(`   Completed: ${record.completed_at || 'Not completed'}`)
      })
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkClaimActions()
