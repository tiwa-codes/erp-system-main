import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get("id")
    const format = searchParams.get("format") || "json"

    if (!reportId) {
      return NextResponse.json({ error: "Report ID is required" }, { status: 400 })
    }

    // Get the report
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        generated_by: {
          select: {
            first_name: true,
            last_name: true
          }
        }
      }
    })

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    if (report.status !== "COMPLETED") {
      return NextResponse.json({ error: "Report is not ready for download" }, { status: 400 })
    }

    // Generate the report data based on type
    let reportData: any = {}
    let filename = ""

    switch (report.report_type) {
      case "utilization":
        filename = `utilization-report-${new Date(report.generated_at).toISOString().split('T')[0]}.${format}`
        
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
          generatedAt: report.generated_at.toISOString(),
          generatedBy: `${report.generated_by.first_name} ${report.generated_by.last_name}`,
          totalEnrollees: enrollees.length,
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
        filename = `overview-breakdown-${new Date(report.generated_at).toISOString().split('T')[0]}.${format}`
        
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
          generatedAt: report.generated_at.toISOString(),
          generatedBy: `${report.generated_by.first_name} ${report.generated_by.last_name}`,
          totalOrganizations: organizations.length,
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
        filename = `analytics-report-${new Date(report.generated_at).toISOString().split('T')[0]}.${format}`
        
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
          generatedAt: report.generated_at.toISOString(),
          generatedBy: `${report.generated_by.first_name} ${report.generated_by.last_name}`,
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
        action: "REPORT_DOWNLOADED",
        resource: "report",
        resource_id: report.id,
        new_values: {
          reportType: report.report_type,
          format,
          filename
        }
      }
    })

    // Return the data based on format
    if (format === "json") {
      return NextResponse.json({
        success: true,
        filename,
        data: reportData
      })
    } else if (format === "csv") {
      // Convert to CSV format
      const csvData = convertToCSV(reportData)
      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      })
    } else {
      return NextResponse.json({ error: "Unsupported format" }, { status: 400 })
    }

  } catch (error) {
    console.error("Error downloading report:", error)
    return NextResponse.json(
      { error: "Failed to download report" },
      { status: 500 }
    )
  }
}

function convertToCSV(data: any): string {
  if (!data.data || !Array.isArray(data.data)) {
    return "No data available"
  }

  const headers = Object.keys(data.data[0])
  const csvRows = [
    headers.join(','),
    ...data.data.map((row: any) => 
      headers.map(header => {
        const value = row[header]
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value
      }).join(',')
    )
  ]

  return csvRows.join('\n')
}
