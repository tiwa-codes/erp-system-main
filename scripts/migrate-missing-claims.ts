import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateMissingClaims() {
  try {
    console.log('🔄 Migrating Existing Approval Codes to Create Missing Claims...\n')
    
    // Find all approval codes without claims
    const approvalCodesWithoutClaims = await prisma.approvalCode.findMany({
      where: {
        claim_id: null,
        status: { in: ['APPROVED', 'PENDING'] },
        amount: { gt: 0 } // Only process codes with amount > 0
      },
      include: {
        enrollee: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true
          }
        }
      }
    })
    
    console.log(`📊 Found ${approvalCodesWithoutClaims.length} approval codes without claims\n`)
    
    let successCount = 0
    let errorCount = 0
    
    for (const approvalCode of approvalCodesWithoutClaims) {
      try {
        console.log(`Processing: ${approvalCode.approval_code}...`)
        
        // Find provider by hospital name
        const provider = await prisma.provider.findFirst({
          where: {
            facility_name: {
              contains: approvalCode.hospital,
              mode: 'insensitive'
            }
          }
        })
        
        if (!provider) {
          console.log(`  ⚠️  No provider found for hospital: ${approvalCode.hospital}`)
          errorCount++
          continue
        }
        
        if (!approvalCode.enrollee) {
          console.log(`  ⚠️  No enrollee found for approval code`)
          errorCount++
          continue
        }
        
        // Generate unique claim number
        const claimNumber = `CLM-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
        
        // Create claim
        const newClaim = await prisma.claim.create({
          data: {
            claim_number: claimNumber,
            enrollee_id: approvalCode.enrollee.enrollee_id,
            principal_id: approvalCode.enrollee_id,
            provider_id: provider.id,
            claim_type: 'MEDICAL',
            amount: approvalCode.amount,
            original_amount: approvalCode.amount,
            status: 'NEW',
            current_stage: null,
            submitted_at: approvalCode.created_at,
            created_by_id: approvalCode.generated_by_id || null,
          }
        })
        
        // Link approval code to claim
        await prisma.approvalCode.update({
          where: { id: approvalCode.id },
          data: {
            claim_id: newClaim.id
          }
        })
        
        console.log(`  ✅ Created claim: ${claimNumber}`)
        successCount++
        
      } catch (error) {
        console.error(`  ❌ Error processing ${approvalCode.approval_code}:`, error instanceof Error ? error.message : String(error))
        errorCount++
      }
    }
    
    console.log(`\n📊 Migration Summary:`)
    console.log(`   ✅ Successfully created: ${successCount} claims`)
    console.log(`   ❌ Errors: ${errorCount}`)
    console.log(`\n✅ Migration complete!`)
    
  } catch (error) {
    console.error('❌ Migration error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

migrateMissingClaims()
