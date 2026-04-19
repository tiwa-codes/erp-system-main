/**
 * List all organizations in the database
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function listOrganizations() {
  console.log('📋 Listing all organizations...\n')

  try {
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        status: true,
        created_at: true
      },
      orderBy: { name: 'asc' }
    })

    if (organizations.length === 0) {
      console.log('No organizations found in database.')
      return
    }

    console.log(`Found ${organizations.length} organization(s):\n`)
    
    for (const org of organizations) {
      // Get principal count
      const principalCount = await prisma.principalAccount.count({
        where: { organization_id: org.id }
      })

      console.log(`📌 ${org.name}`)
      console.log(`   Code: ${org.code}`)
      console.log(`   Type: ${org.type}`)
      console.log(`   Status: ${org.status}`)
      console.log(`   Principals: ${principalCount}`)
      console.log(`   Created: ${org.created_at.toISOString().split('T')[0]}`)
      console.log(`   ID: ${org.id}`)
      console.log('')
    }

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

listOrganizations()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })

