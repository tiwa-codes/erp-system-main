import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkApprovalCodes() {
  try {
    console.log('🔍 Checking all approval codes in database...\n')
    
    // Get all approval codes
    const allCodes = await prisma.approvalCode.findMany({
      orderBy: { created_at: 'desc' },
      take: 20,
      select: {
        id: true,
        approval_code: true,
        hospital: true,
        provider_id: true,
        enrollee_id: true,
        status: true,
        created_at: true,
      }
    })
    
    console.log(`Total approval codes in database: ${allCodes.length}\n`)
    
    if (allCodes.length > 0) {
      console.log('📋 Recent approval codes:')
      allCodes.forEach((code, index) => {
        console.log(`${index + 1}. ${code.approval_code}`)
        console.log(`   Hospital: ${code.hospital}`)
        console.log(`   Provider ID: ${code.provider_id || 'NULL'}`)
        console.log(`   Status: ${code.status}`)
        console.log(`   Created: ${code.created_at}`)
        console.log()
      })
    } else {
      console.log('❌ No approval codes found in database!')
    }
    
    // Count by prefix
    const aprCodes = await prisma.approvalCode.count({
      where: { approval_code: { startsWith: 'APR-' } }
    })
    const encCodes = await prisma.approvalCode.count({
      where: { approval_code: { startsWith: 'ENC-' } }
    })
    
    console.log('\n📊 Approval codes by prefix:')
    console.log(`APR- codes: ${aprCodes}`)
    console.log(`ENC- codes: ${encCodes}`)
    
    // Check recent provider requests
    console.log('\n🔍 Checking recent provider requests...')
    const recentRequests = await prisma.providerRequest.findMany({
      orderBy: { created_at: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        hospital: true,
        created_at: true,
        updated_at: true,
      }
    })
    
    console.log(`\nRecent provider requests: ${recentRequests.length}`)
    recentRequests.forEach((req, index) => {
      console.log(`${index + 1}. ID: ${req.id} | Status: ${req.status} | Hospital: ${req.hospital}`)
      console.log(`   Created: ${req.created_at}`)
      console.log(`   Updated: ${req.updated_at}`)
      console.log()
    })
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkApprovalCodes()
