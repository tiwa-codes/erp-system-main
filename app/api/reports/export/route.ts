import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has reports permissions
    const hasPermission = await checkPermission(session.user.role as any, "reports", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const { reportType, format, filters } = body

    // Generate report data based on type
    let reportData: any = {}
    let filename = ""

    switch (reportType) {
      case "utilization":
        filename = `utilization-report-${new Date().toISOString().split('T')[0]}.${format}`
        
        // Get utilization data
        const enrollees = await prisma.principalAccount.findMany({
          include: {
            plan: {
              select: {
                name: true,
                premium_amount: true,
                annual_limit: true
              }
            },
            claims: {
              select: {
                id: true,
                amount: true,
                status: true
              }
            }
          }
        })

        reportData = {
          title: "Utilization Report",
          generatedAt: new Date().toISOString(),
          generatedBy: session.user.name || 'Unknown User',
          data: enrollees.map(enrollee => {
            const totalClaimsAmount = enrollee.claims.reduce((sum, claim) => sum + Number(claim.amount), 0)
            const approvedClaimsAmount = enrollee.claims
              .filter(claim => claim.status === "APPROVED")
              .reduce((sum, claim) => sum + Number(claim.amount), 0)
            
            return {
              enrolleeId: enrollee.enrollee_id,
              enrolleeName: `${enrollee.first_name} ${enrollee.last_name}`,
              planName: enrollee.plan?.name || "No Plan",
              amountUtilized: approvedClaimsAmount,
              balance: Number(enrollee.plan?.annual_limit || 0) - approvedClaimsAmount,
              status: enrollee.status
            }
          })
        }
        break

      case "overview":
        filename = `overview-breakdown-${new Date().toISOString().split('T')[0]}.${format}`
        
        // Get overview data
        const organizations = await prisma.organization.findMany({
          include: {
            principal_accounts: {
              include: {
                claims: {
                  select: {
                    id: true,
                    amount: true,
                    status: true
                  }
                }
              }
            }
          }
        })

        reportData = {
          title: "Overview Breakdown Report",
          generatedAt: new Date().toISOString(),
          generatedBy: session.user.name || 'Unknown User',
          data: organizations.map(org => {
            const totalEnrollees = org.principal_accounts.length
            const totalServices = org.principal_accounts.reduce((sum, account) => {
              return sum + account.claims.length
            }, 0)
            
            const totalClaimsAmount = org.principal_accounts.reduce((sum, account) => {
              return sum + account.claims.reduce((claimSum, claim) => claimSum + Number(claim.amount), 0)
            }, 0)
            
            const approvedClaimsAmount = org.principal_accounts.reduce((sum, account) => {
              return sum + account.claims
                .filter(claim => claim.status === "APPROVED")
                .reduce((claimSum, claim) => claimSum + Number(claim.amount), 0)
            }, 0)

            const approvalRate = totalClaimsAmount > 0 ? (approvedClaimsAmount / totalClaimsAmount) * 100 : 0
            const utilizationRate = totalEnrollees > 0 ? (totalServices / totalEnrollees) * 10 : 0
            const performanceScore = Math.min(100, Math.round((approvalRate * 0.7) + (utilizationRate * 0.3)))

            return {
              organizationName: org.name,
              enrolleesCount: totalEnrollees,
              servicesCount: totalServices,
              performanceScore: performanceScore,
              status: org.status
            }
          })
        }
        break

      case "analytics":
        filename = `analytics-report-${new Date().toISOString().split('T')[0]}.${format}`
        
        // Get analytics data
        const [totalEnrollees, totalClaims, totalPayout, activeProviders] = await Promise.all([
          prisma.principalAccount.count(),
          prisma.claim.count(),
          prisma.financialTransaction.aggregate({
            where: {
              transaction_type: "CLAIM_PAYOUT",
              status: "PROCESSED"
            },
            _sum: {
              amount: true
            }
          }),
          prisma.provider.count({
            where: {
              status: "APPROVED"
            }
          })
        ])

        reportData = {
          title: "Analytics Report",
          generatedAt: new Date().toISOString(),
          generatedBy: session.user.name || 'Unknown User',
          data: {
            totalEnrollees,
            totalClaims,
            totalPayout: Number(totalPayout._sum.amount || 0),
            activeProviders
          }
        }
        break

      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 })
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "REPORT_EXPORT",
        resource: "report",
        resource_id: reportType,
        new_values: {
          reportType,
          format,
          filename,
          filters
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `${format.toUpperCase()} export generated successfully`,
      filename,
      downloadUrl: `/api/reports/download/${filename}`,
      reportData
    })

  } catch (error) {
    console.error("Error generating report export:", error)
    return NextResponse.json(
      { error: "Failed to generate report export" },
      { status: 500 }
    )
  }
}
