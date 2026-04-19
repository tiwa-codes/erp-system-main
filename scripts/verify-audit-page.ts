import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const claimId = 'cmjgsn9am0045iu5oqm9auvqf'
  
  console.log('Verifying audit page fix...\n')
  
  // Get claim details
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: {
      id: true,
      claim_number: true,
      status: true,
      current_stage: true,
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
  
  console.log('Claim Details:')
  console.log('- Claim Number:', claim.claim_number)
  console.log('- Status:', claim.status)
  console.log('- Current Stage:', claim.current_stage)
  console.log('- Provider:', claim.provider.facility_name)
  console.log()
  
  // Get vetting actions
  const vettingActions = await prisma.vettingAction.findMany({
    where: { claim_id: claimId },
    include: {
      action_by: {
        select: {
          first_name: true,
          last_name: true,
          role: {
            select: { name: true }
          }
        }
      }
    },
    orderBy: { created_at: 'asc' }
  })
  
  console.log(`Vetting Actions (${vettingActions.length}):`)
  vettingActions.forEach((action, index) => {
    console.log(`${index + 1}. Stage: ${action.stage}`)
    console.log(`   Action: ${action.action}`)
    console.log(`   By: ${action.action_by.first_name} ${action.action_by.last_name} (${action.action_by.role.name})`)
    console.log(`   At: ${action.created_at}`)
    console.log()
  })
  
  // Check if audit action exists
  const auditAction = vettingActions.find(a => a.stage === 'audit')
  
  if (auditAction) {
    console.log('✅ Audit action already exists')
    console.log('   Expected: Action buttons should be HIDDEN')
    console.log('   Message should show: "Action Already Taken"')
  } else {
    console.log('✅ No audit action exists yet')
    console.log('   Expected: Action buttons should be VISIBLE')
    console.log('   User can take action at audit stage')
  }
  console.log()
  
  // Get provider request for services
  const providerRequest = await prisma.providerRequest.findFirst({
    where: { claim_id: claimId },
    select: {
      id: true,
      services: true,
      status: true
    }
  })
  
  if (providerRequest) {
    console.log('Provider Request:')
    console.log('- ID:', providerRequest.id)
    console.log('- Status:', providerRequest.status)
    
    try {
      const services = JSON.parse(providerRequest.services)
      console.log(`- Services: ${services.length} services found`)
      console.log('   Expected: Real services data will be displayed on audit page')
    } catch (error) {
      console.log('- Services: Could not parse')
      console.log('   Expected: Mock services data will be used as fallback')
    }
  } else {
    console.log('⚠️  No provider request found')
    console.log('   Expected: Mock services data will be used')
  }
  console.log()
  
  console.log('Summary:')
  console.log('- Claim is at stage:', claim.current_stage)
  console.log('- Can user take action?', !auditAction ? 'YES ✅' : 'NO ❌')
  console.log('- URL to test:', `/operation-desk/audit/process/${claimId}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
