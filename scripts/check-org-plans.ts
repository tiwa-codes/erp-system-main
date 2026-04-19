import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkOrgPlans() {
  try {
    // Find Test Organization
    const testOrg = await prisma.organization.findFirst({
      where: {
        name: {
          contains: 'Test',
          mode: 'insensitive'
        }
      },
      include: {
        organization_plans: {
          include: {
            plan: true
          }
        }
      }
    })

    if (!testOrg) {
      console.log('❌ Test Organization not found')
      return
    }

    console.log('\n📋 Organization:', testOrg.name, `(${testOrg.code})`)
    console.log('🆔 ID:', testOrg.id)
    console.log('\n📊 Organization Plans:', testOrg.organization_plans?.length || 0)
    
    if (testOrg.organization_plans && testOrg.organization_plans.length > 0) {
      console.log('\n✅ Plans found:')
      testOrg.organization_plans.forEach((orgPlan: any, index: number) => {
        console.log(`\n  ${index + 1}. Plan ID: ${orgPlan.plan_id}`)
        console.log(`     Plan Name: ${orgPlan.plan?.name || 'N/A'}`)
        console.log(`     Plan Type: ${orgPlan.plan?.plan_type || 'N/A'}`)
        console.log(`     Plan Status: ${orgPlan.plan?.status || 'N/A'}`)
        console.log(`     Is Default: ${orgPlan.is_default || false}`)
      })
    } else {
      console.log('\n⚠️  No plans associated with this organization')
      console.log('\n💡 To add plans to this organization, use the Underwriting >> Organizations page')
    }

    // Check all organizations with plans
    const allOrgs = await prisma.organization.findMany({
      include: {
        organization_plans: {
          include: {
            plan: true
          }
        }
      }
    })

    console.log('\n\n📊 All Organizations Summary:')
    allOrgs.forEach((org: any) => {
      console.log(`  - ${org.name} (${org.code}): ${org.organization_plans?.length || 0} plans`)
    })

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkOrgPlans()
