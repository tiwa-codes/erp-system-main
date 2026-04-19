import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyPrimaryServicesClaims() {
  try {
    console.log('🔍 Verifying Primary Services Claims Creation...\n')
    
    // Check approval codes without claims (problematic ones)
    const approvalCodesWithoutClaims = await prisma.approvalCode.findMany({
      where: {
        claim_id: null,
        status: { in: ['APPROVED', 'PENDING'] }
      },
      include: {
        enrollee: {
          select: {
            enrollee_id: true,
            first_name: true,
            last_name: true
          }
        }
      },
      take: 10
    })
    
    console.log(`📊 Approval Codes WITHOUT Claims: ${approvalCodesWithoutClaims.length}`)
    if (approvalCodesWithoutClaims.length > 0) {
      console.log('\n⚠️  These approval codes don\'t have claims yet:')
      approvalCodesWithoutClaims.forEach((code, index) => {
        console.log(`  ${index + 1}. ${code.approval_code}`)
        console.log(`     Status: ${code.status}`)
        console.log(`     Enrollee: ${code.enrollee?.first_name} ${code.enrollee?.last_name}`)
        console.log(`     Amount: ${code.amount}`)
        console.log(`     Hospital: ${code.hospital}`)
        console.log(`     Created: ${code.created_at}`)
        console.log()
      })
    } else {
      console.log('   ✅ All approval codes have claims linked!')
    }
    
    // Check NEW claims
    const newClaims = await prisma.claim.findMany({
      where: {
        status: 'NEW'
      },
      include: {
        provider: {
          select: {
            facility_name: true
          }
        },
        principal: {
          select: {
            enrollee_id: true,
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      take: 10
    })
    
    console.log(`\n📋 Claims with NEW Status: ${newClaims.length}`)
    if (newClaims.length > 0) {
      newClaims.forEach((claim, index) => {
        console.log(`  ${index + 1}. ${claim.claim_number}`)
        console.log(`     Provider: ${claim.provider?.facility_name}`)
        console.log(`     Enrollee: ${claim.principal?.first_name} ${claim.principal?.last_name}`)
        console.log(`     Amount: ${claim.amount}`)
        console.log()
      })
    }
    
    console.log(`\n✅ Expected Flow for Primary Services:`)
    console.log(`   1. Provider generates approval code`)
    console.log(`   2. Claim automatically created with status: NEW`)
    console.log(`   3. Claim appears in Provider >> Claims Request`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyPrimaryServicesClaims()
