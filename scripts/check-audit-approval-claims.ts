import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAuditApprovalClaims() {
  try {
    console.log('🔍 Checking claims in audit and approval stages...\n')
    
    // Check audit stage claims
    console.log('📋 AUDIT STAGE (current_stage: "audit"):')
    const auditStageClaims = await prisma.claim.findMany({
      where: { current_stage: 'audit' },
      select: {
        id: true,
        claim_number: true,
        status: true,
        current_stage: true,
        amount: true,
        provider: { select: { facility_name: true } }
      },
      take: 10
    })
    
    console.log(`   Found: ${auditStageClaims.length} claims`)
    auditStageClaims.forEach(claim => {
      console.log(`   - ${claim.claim_number}: ${claim.status} (${claim.provider?.facility_name})`)
    })
    
    // Check approval stage claims
    console.log('\n📋 APPROVAL STAGE (current_stage: "approval"):')
    const approvalStageClaims = await prisma.claim.findMany({
      where: { current_stage: 'approval' },
      select: {
        id: true,
        claim_number: true,
        status: true,
        current_stage: true,
        amount: true,
        provider: { select: { facility_name: true } }
      },
      take: 10
    })
    
    console.log(`   Found: ${approvalStageClaims.length} claims`)
    approvalStageClaims.forEach(claim => {
      console.log(`   - ${claim.claim_number}: ${claim.status} (${claim.provider?.facility_name})`)
    })
    
    // Check what statuses exist
    console.log('\n📊 All claim statuses in database:')
    const statuses = await prisma.claim.groupBy({
      by: ['status'],
      _count: true,
      orderBy: { _count: { status: 'desc' } }
    })
    
    statuses.forEach(s => {
      console.log(`   ${s.status}: ${s._count} claims`)
    })
    
    // Check current_stage values
    console.log('\n📍 All current_stage values in database:')
    const stages = await prisma.claim.groupBy({
      by: ['current_stage'],
      _count: true,
      orderBy: { _count: { current_stage: 'desc' } }
    })
    
    stages.forEach(s => {
      console.log(`   ${s.current_stage || 'null'}: ${s._count} claims`)
    })
    
    // Check for claims with audit_records
    console.log('\n🔍 Claims with audit_records:')
    const withAudit = await prisma.claim.count({
      where: {
        audit_records: { some: {} }
      }
    })
    console.log(`   ${withAudit} claims have audit records`)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAuditApprovalClaims()
