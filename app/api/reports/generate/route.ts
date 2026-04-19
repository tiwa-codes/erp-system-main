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
    const { reportType, category, department, filters } = body

    // Create report record
    const report = await prisma.report.create({
      data: {
        report_name: `${reportType} Report - ${new Date().toLocaleDateString()}`,
        report_type: reportType,
        category: category || "General",
        department: department || null,
        filters: filters || {},
        status: "PROCESSING",
        generated_by_id: session.user.id
      }
    })

    // Generate report data based on type
    let reportData: any = {}
    let filename = ""

    try {
      switch (reportType) {
        case "utilization":
          filename = `utilization-report-${new Date().toISOString().split('T')[0]}.json`
          
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
          filename = `overview-breakdown-${new Date().toISOString().split('T')[0]}.json`
          
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
          filename = `analytics-report-${new Date().toISOString().split('T')[0]}.json`
          
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

        case "financial":
          filename = `financial-report-${new Date().toISOString().split('T')[0]}.json`
          
          // Get financial data
          const [invoices, transactions] = await Promise.all([
            prisma.invoice.findMany({
              include: {
                plan: {
                  select: {
                    name: true
                  }
                }
              }
            }),
            prisma.financialTransaction.findMany({
              include: {
                created_by: {
                  select: {
                    first_name: true,
                    last_name: true
                  }
                }
              }
            })
          ])

          reportData = {
            title: "Financial Report",
            generatedAt: new Date().toISOString(),
            generatedBy: session.user.name || 'Unknown User',
            data: {
              invoices: invoices.map(invoice => ({
                invoiceNumber: invoice.invoice_number,
                enrolleeName: invoice.enrollee_name,
                planName: invoice.plan?.name || "No Plan",
                amount: Number(invoice.plan_amount),
                status: invoice.status,
                dueDate: invoice.due_date,
                paidAt: invoice.paid_at
              })),
              transactions: transactions.map(transaction => ({
                id: transaction.id,
                type: transaction.transaction_type,
                amount: Number(transaction.amount),
                status: transaction.status,
                description: transaction.description,
                createdBy: `${transaction.created_by.first_name} ${transaction.created_by.last_name}`,
                createdAt: transaction.created_at
              }))
            }
          }
          break

        case "claims":
          filename = `claims-report-${new Date().toISOString().split('T')[0]}.json`
          
          // Get claims data
          const claims = await prisma.claim.findMany({
            include: {
              principal_account: {
                select: {
                  enrollee_id: true,
                  first_name: true,
                  last_name: true
                }
              },
              created_by: {
                select: {
                  first_name: true,
                  last_name: true
                }
              }
            }
          })

          reportData = {
            title: "Claims Report",
            generatedAt: new Date().toISOString(),
            generatedBy: session.user.name || 'Unknown User',
            totalClaims: claims.length,
            data: claims.map(claim => ({
              claimNumber: claim.claim_number,
              enrolleeId: claim.principal_account?.enrollee_id,
              enrolleeName: claim.principal_account ? `${claim.principal_account.first_name} ${claim.principal_account.last_name}` : "Unknown",
              amount: Number(claim.amount),
              status: claim.status,
              diagnosis: claim.diagnosis,
              createdBy: `${claim.created_by.first_name} ${claim.created_by.last_name}`,
              createdAt: claim.created_at
            }))
          }
          break

        case "provider":
          filename = `provider-report-${new Date().toISOString().split('T')[0]}.json`
          
          // Get provider data
          const providers = await prisma.provider.findMany({
            include: {
              claims: {
                select: {
                  id: true,
                  amount: true,
                  status: true
                }
              },
              _count: {
                select: {
                  claims: true
                }
              }
            }
          })

          reportData = {
            title: "Provider Report",
            generatedAt: new Date().toISOString(),
            generatedBy: session.user.name || 'Unknown User',
            totalProviders: providers.length,
            data: providers.map(provider => {
              const totalClaimsAmount = provider.claims.reduce((sum, claim) => sum + Number(claim.amount), 0)
              const approvedClaimsAmount = provider.claims
                .filter(claim => claim.status === "APPROVED")
                .reduce((sum, claim) => sum + Number(claim.amount), 0)

              return {
                facilityName: provider.facility_name,
                address: provider.address,
                phone: provider.phone_whatsapp,
                email: provider.email,
                status: provider.status,
                totalClaims: provider._count.claims,
                totalClaimsAmount: totalClaimsAmount,
                approvedClaimsAmount: approvedClaimsAmount,
                approvalRate: totalClaimsAmount > 0 ? (approvedClaimsAmount / totalClaimsAmount) * 100 : 0
              }
            })
          }
          break

        default:
          return NextResponse.json({ error: "Invalid report type" }, { status: 400 })
      }

      // Update report with completed status
      await prisma.report.update({
        where: { id: report.id },
        data: {
          status: "COMPLETED",
          completed_at: new Date(),
          file_path: filename
        }
      })

      // Create audit log
      await prisma.auditLog.create({
        data: {
          user_id: session.user.id,
          action: "REPORT_GENERATED",
          resource: "report",
          resource_id: report.id,
          new_values: {
            reportType,
            category,
            department,
            filename
          }
        }
      })

      return NextResponse.json({
        success: true,
        message: "Report generated successfully",
        report: {
          id: report.id,
          name: report.report_name,
          type: report.report_type,
          status: report.status,
          filename,
          generatedAt: report.generated_at
        },
        data: reportData
      })

    } catch (error) {
      // Update report with failed status
      await prisma.report.update({
        where: { id: report.id },
        data: {
          status: "FAILED",
          error_message: error instanceof Error ? error.message : "Unknown error"
        }
      })

      throw error
    }

  } catch (error) {
    console.error("Error generating report:", error)
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    )
  }
}
