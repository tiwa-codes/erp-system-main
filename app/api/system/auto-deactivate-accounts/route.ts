import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    console.log("Starting automatic account deactivation check...")

    // Find all active principal accounts with plans
    const activeAccounts = await prisma.principalAccount.findMany({
      where: {
        status: "ACTIVE"
      },
      include: {
        plan: {
          include: {
            package_limits: {
              where: {
                status: "ACTIVE"
              }
            }
          }
        },
        claims: {
          where: {
            status: {
              in: ["APPROVED", "PAID"]
            }
          }
        }
      }
    })

    let deactivatedCount = 0
    const deactivationReasons: string[] = []

    for (const account of activeAccounts) {
      let shouldDeactivate = false
      let reason = ""

      // Check if plan has expired
      if (account.plan?.end_date && new Date(account.plan.end_date) < new Date()) {
        shouldDeactivate = true
        reason = "Plan expired"
      }

      // Check package limits
      if (!shouldDeactivate && account.plan?.package_limits) {
        for (const packageLimit of account.plan.package_limits) {
          // Parse time frame to calculate the limit period
          const timeFrameMatch = packageLimit.time_frame.match(/^(\d+)\s*(.+)$/)
          if (!timeFrameMatch) continue

          const timeFrameValue = parseInt(timeFrameMatch[1])
          const timeFrameUnit = timeFrameMatch[2].toLowerCase()

          // Calculate the start date based on time frame
          const now = new Date()
          let startDate = new Date()

          switch (timeFrameUnit) {
            case 'hours':
              startDate.setHours(now.getHours() - timeFrameValue)
              break
            case 'days':
              startDate.setDate(now.getDate() - timeFrameValue)
              break
            case 'weeks':
              startDate.setDate(now.getDate() - (timeFrameValue * 7))
              break
            case 'months':
              startDate.setMonth(now.getMonth() - timeFrameValue)
              break
            case 'years':
              startDate.setFullYear(now.getFullYear() - timeFrameValue)
              break
            default:
              continue
          }

          // Get total amount used by this enrollee for this package type within the time frame
          const totalUsed = await prisma.claim.aggregate({
            where: {
              enrollee_id: account.id,
              package_type: packageLimit.package_type,
              status: {
                in: ['APPROVED', 'PAID']
              },
              created_at: {
                gte: startDate
              }
            },
            _sum: {
              amount: true
            }
          })

          const usedAmount = totalUsed._sum.amount || 0
          const limitAmount = packageLimit.amount

          if (usedAmount >= limitAmount) {
            shouldDeactivate = true
            reason = `Package limit exceeded for ${packageLimit.package_type}`
            break
          }
        }
      }

      // Deactivate account if needed
      if (shouldDeactivate) {
        await prisma.principalAccount.update({
          where: { id: account.id },
          data: { 
            status: "INACTIVE",
            updated_at: new Date()
          }
        })

        // Create audit log
        await prisma.auditLog.create({
          data: {
            user_id: "system", // System action
            action: "ACCOUNT_AUTO_DEACTIVATED",
            resource: "principal_account",
            resource_id: account.id,
            new_values: {
              status: "INACTIVE",
              reason: reason,
              deactivated_at: new Date()
            }
          }
        })

        deactivatedCount++
        deactivationReasons.push(`${account.enrollee_id}: ${reason}`)
        
        console.log(`Deactivated account ${account.enrollee_id}: ${reason}`)
      }
    }

    console.log(`Automatic deactivation completed. ${deactivatedCount} accounts deactivated.`)

    return NextResponse.json({
      success: true,
      message: `Automatic deactivation completed`,
      deactivatedCount,
      deactivationReasons: deactivationReasons.slice(0, 10) // Limit to first 10 for response
    })

  } catch (error) {
    console.error("Error in automatic account deactivation:", error)
    return NextResponse.json(
      { error: "Failed to perform automatic deactivation" },
      { status: 500 }
    )
  }
}

// GET endpoint to manually trigger the deactivation check
export async function GET(request: NextRequest) {
  try {
    console.log("Manual trigger of automatic account deactivation check...")
    
    // Call the POST logic
    const result = await POST(request)
    return result
    
  } catch (error) {
    console.error("Error in manual deactivation trigger:", error)
    return NextResponse.json(
      { error: "Failed to trigger deactivation check" },
      { status: 500 }
    )
  }
}