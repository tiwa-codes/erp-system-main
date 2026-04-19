import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyProviderFiltering() {
  try {
    console.log('🔍 Verifying Provider Filtering Logic...\n')
    
    // Check all provider users
    const providerUsers = await prisma.user.findMany({
      where: {
        role: {
          name: 'PROVIDER'
        },
        provider_id: { not: null }
      },
      include: {
        role: {
          select: {
            name: true
          }
        },
        provider: {
          select: {
            id: true,
            facility_name: true,
            facility_type: true
          }
        }
      },
      take: 5
    })
    
    console.log(`📊 Found ${providerUsers.length} users with PROVIDER role\n`)
    
    for (const user of providerUsers) {
      console.log(`👤 ${user.first_name} ${user.last_name}`)
      console.log(`   Email: ${user.email}`)
      console.log(`   Role: ${user.role?.name}`)
      console.log(`   Provider: ${user.provider?.facility_name}`)
      console.log(`   Provider ID: ${user.provider_id}`)
      
      // Count claims for this provider
      const claimCount = await prisma.claim.count({
        where: {
          provider_id: user.provider_id!,
          status: { in: ['NEW', 'PENDING', 'PAID'] }
        }
      })
      
      console.log(`   📋 Claims for this provider: ${claimCount}`)
      console.log()
    }
    
    // Check SUPER_ADMIN
    const superAdmin = await prisma.user.findFirst({
      where: {
        role: {
          name: 'SUPER_ADMIN'
        }
      },
      include: {
        role: {
          select: {
            name: true
          }
        }
      }
    })
    
    if (superAdmin) {
      console.log(`👤 ${superAdmin.first_name} ${superAdmin.last_name} (SUPER_ADMIN)`)
      console.log(`   Email: ${superAdmin.email}`)
      console.log(`   Role: ${superAdmin.role?.name}`)
      console.log(`   Provider ID: ${superAdmin.provider_id || 'None (can see all)'}`)
      
      const totalClaims = await prisma.claim.count({
        where: {
          status: { in: ['NEW', 'PENDING', 'PAID'] }
        }
      })
      console.log(`   📋 Total claims in system: ${totalClaims}`)
      console.log()
    }
    
    // Summary
    console.log(`\n✅ Expected Behavior:`)
    console.log(`   • PROVIDER role → Only sees claims for their provider_id`)
    console.log(`   • SUPER_ADMIN role → Sees all claims (no provider_id filter)`)
    console.log(`   • PROVIDER_MANAGER role → Sees all claims`)
    console.log(`   • Other roles → Sees all claims`)
    
    console.log(`\n📋 Claims Distribution:`)
    const claimsByProvider = await prisma.claim.groupBy({
      by: ['provider_id'],
      where: {
        status: { in: ['NEW', 'PENDING', 'PAID'] }
      },
      _count: true
    })
    
    for (const group of claimsByProvider) {
      const provider = await prisma.provider.findUnique({
        where: { id: group.provider_id },
        select: { facility_name: true }
      })
      console.log(`   ${provider?.facility_name || 'Unknown'}: ${group._count} claims`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyProviderFiltering()
