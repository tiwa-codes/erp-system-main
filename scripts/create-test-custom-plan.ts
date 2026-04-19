/**
 * Script to create a test custom plan for Special Risk module testing
 * 
 * Usage:
 * 1. Make sure you have a user with UNDERWRITER or ADMIN role
 * 2. Run: npx tsx scripts/create-test-custom-plan.ts
 * 
 * This will create a test plan in SPECIAL_RISK approval stage
 */

import { PrismaClient, ApprovalStage, PlanStatus, PlanType, PlanClassification } from "@prisma/client"

const prisma = new PrismaClient()

async function createTestCustomPlan() {
  try {
    // Find a user with appropriate role (UNDERWRITER or ADMIN)
    const user = await prisma.user.findFirst({
      where: {
        role: {
          name: {
            in: ["UNDERWRITER", "ADMIN", "SUPER_ADMIN"]
          }
        }
      },
      include: {
        role: true
      }
    })

    if (!user) {
      console.error("❌ No user found with UNDERWRITER, ADMIN, or SUPER_ADMIN role")
      console.log("Please create a user with one of these roles first")
      return
    }

    console.log(`✅ Found user: ${user.first_name} ${user.last_name} (${user.role?.name})`)

    // Create a test custom plan
    const testPlan = await prisma.plan.create({
      data: {
        plan_id: `TEST-${Date.now()}`,
        name: "Test Custom Plan - Special Risk",
        description: "This is a test custom plan created for testing the Special Risk module",
        plan_type: PlanType.CUSTOM,
        classification: PlanClassification.INDIVIDUAL,
        premium_amount: 50000,
        annual_limit: 500000,
        status: PlanStatus.PENDING_APPROVAL,
        approval_stage: ApprovalStage.SPECIAL_RISK,
        is_customized: true,
        created_by_id: user.id,
        metadata: {
          test: true,
          created_for: "Special Risk Module Testing"
        }
      },
      include: {
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    })

    console.log("\n✅ Test custom plan created successfully!")
    console.log("\n📋 Plan Details:")
    console.log(`   Plan ID: ${testPlan.plan_id}`)
    console.log(`   Name: ${testPlan.name}`)
    console.log(`   Status: ${testPlan.status}`)
    console.log(`   Approval Stage: ${testPlan.approval_stage}`)
    console.log(`   Premium: ₦${testPlan.premium_amount.toLocaleString()}`)
    console.log(`   Annual Limit: ₦${testPlan.annual_limit.toLocaleString()}`)
    console.log(`   Created By: ${testPlan.created_by?.first_name} ${testPlan.created_by?.last_name}`)
    console.log(`\n🔗 View the plan at: /special-risk/custom-plans/${testPlan.id}`)
    console.log("\n💡 Next steps:")
    console.log("   1. Go to Special Risk > Custom Plans")
    console.log("   2. You should see the test plan in the list")
    console.log("   3. Click 'View' to see plan details")
    console.log("   4. Click 'Edit' to test editing (if status is PENDING_APPROVAL)")
    console.log("   5. Click 'Approve' to test approval workflow")

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: "TEST_PLAN_CREATED",
        resource: "plan",
        resource_id: testPlan.id,
        new_values: {
          plan_id: testPlan.plan_id,
          name: testPlan.name,
          approval_stage: testPlan.approval_stage
        }
      }
    })

  } catch (error) {
    console.error("❌ Error creating test plan:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
createTestCustomPlan()
  .then(() => {
    console.log("\n✅ Script completed successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error)
    process.exit(1)
  })

