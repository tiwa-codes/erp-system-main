import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkApprovalCodes() {
  console.log('=== CHECKING APPROVAL CODES IN DATABASE ===\n')

  try {
    // Check all approval codes
    const allApprovalCodes = await prisma.approvalCode.findMany({
      select: {
        id: true,
        approval_code: true,
        status: true,
        created_at: true,
        enrollee_name: true,
        hospital: true
      },
      orderBy: { created_at: 'desc' }
    })

    console.log(`Total approval codes found: ${allApprovalCodes.length}`)
    
    // Group by code prefix
    const aprCodes = allApprovalCodes.filter(ac => ac.approval_code.startsWith('APR-'))
    const encCodes = allApprovalCodes.filter(ac => ac.approval_code.startsWith('ENC-'))
    const otherCodes = allApprovalCodes.filter(ac => !ac.approval_code.startsWith('APR-') && !ac.approval_code.startsWith('ENC-'))

    console.log(`\nAPR- codes (approval codes): ${aprCodes.length}`)
    aprCodes.forEach(code => {
      console.log(`  - ${code.approval_code} | ${code.status} | ${code.enrollee_name} | ${code.hospital}`)
    })

    console.log(`\nENC- codes (encounter codes): ${encCodes.length}`)
    encCodes.forEach(code => {
      console.log(`  - ${code.approval_code} | ${code.status} | ${code.enrollee_name} | ${code.hospital}`)
    })

    console.log(`\nOther codes: ${otherCodes.length}`)
    otherCodes.forEach(code => {
      console.log(`  - ${code.approval_code} | ${code.status} | ${code.enrollee_name} | ${code.hospital}`)
    })

    // Check if there are any APR- codes with PENDING status
    const pendingAprCodes = aprCodes.filter(ac => ac.status === 'PENDING')
    console.log(`\nPENDING APR- codes: ${pendingAprCodes.length}`)
    pendingAprCodes.forEach(code => {
      console.log(`  - ${code.approval_code} | ${code.enrollee_name} | ${code.hospital}`)
    })

    // Check if there are any APR- codes with APPROVED status
    const approvedAprCodes = aprCodes.filter(ac => ac.status === 'APPROVED')
    console.log(`\nAPPROVED APR- codes: ${approvedAprCodes.length}`)
    approvedAprCodes.forEach(code => {
      console.log(`  - ${code.approval_code} | ${code.enrollee_name} | ${code.hospital}`)
    })

    // Check if there are any APR- codes with PARTIAL status
    const partialAprCodes = aprCodes.filter(ac => ac.status === 'PARTIAL')
    console.log(`\nPARTIAL APR- codes: ${partialAprCodes.length}`)
    partialAprCodes.forEach(code => {
      console.log(`  - ${code.approval_code} | ${code.enrollee_name} | ${code.hospital}`)
    })

    // Check if there are any APR- codes with REJECTED status
    const rejectedAprCodes = aprCodes.filter(ac => ac.status === 'REJECTED')
    console.log(`\nREJECTED APR- codes: ${rejectedAprCodes.length}`)
    rejectedAprCodes.forEach(code => {
      console.log(`  - ${code.approval_code} | ${code.enrollee_name} | ${code.hospital}`)
    })

  } catch (error) {
    console.error('Error checking approval codes:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkApprovalCodes()
