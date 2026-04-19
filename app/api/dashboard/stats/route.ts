import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    void request

    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's role to determine data access level
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        role: true,
        provider: {
          select: {
            id: true,
            facility_name: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userRole = user.role?.name || 'HR_OFFICER'
    
    // Determine data access level based on role
    const isSuperAdmin = userRole === 'SUPER_ADMIN'
    const isAdmin = userRole === 'ADMIN'
    const isFinanceRole = ['FINANCE_OFFICER'].includes(userRole)
    const isClaimsRole = ['CLAIMS_MANAGER', 'CLAIMS_PROCESSOR'].includes(userRole)
    const isUnderwriterRole = ['UNDERWRITER'].includes(userRole)
    const isProviderRole = userRole === 'PROVIDER'

    // Build base where clauses for filtering
    let principalWhereClause: Prisma.PrincipalAccountWhereInput = { status: 'ACTIVE' }
    let dependentWhereClause: Prisma.DependentWhereInput = { status: 'ACTIVE' }
    let organizationWhereClause: Prisma.OrganizationWhereInput = { status: 'ACTIVE' }
    let claimsWhereClause: Prisma.ClaimWhereInput = {}
    let payoutWhereClause: Prisma.PayoutWhereInput = {}

    // For non-super-admin roles, filter data based on their access level
    if (!isSuperAdmin) {
      if (isAdmin) {
        // Admin can see all data (same as super admin for now)
        // Could be customized to show only admin-managed data
      } else if (isUnderwriterRole) {
        // Underwriter can see enrollees from organizations they manage
        // This would require additional logic to determine which organizations they manage
        // For now, show limited data
      } else {
        // Other roles see very limited data
        principalWhereClause = {
          status: 'ACTIVE',
        }
        dependentWhereClause = {
          status: 'ACTIVE',
        }
      }
    }

    // Get data based on user's access level
    const baseQueries: Promise<any>[] = [
      // Total Principals (filtered by access level)
      prisma.principalAccount.count({
        where: principalWhereClause
      }),
      
      // Total Dependents (filtered by access level)
      prisma.dependent.count({
        where: dependentWhereClause
      }),
      
      // Total Organizations (filtered by access level)
      prisma.organization.count({
        where: organizationWhereClause
      }),
      
      // Pending Invoices (only show to finance roles and above)
      (isSuperAdmin || isAdmin || isFinanceRole) ? 
        prisma.payout.count({
          where: { ...payoutWhereClause, status: 'PENDING' }
        }) : Promise.resolve(0),
      
      // Pending Claims (only show to claims roles and above)
      (isSuperAdmin || isAdmin || isClaimsRole) ? 
        prisma.claim.count({
          where: { ...claimsWhereClause, status: 'SUBMITTED' }
        }) : Promise.resolve(0),
      
      // Enrollee data for table (filtered by access level)
      prisma.principalAccount.findMany({
        where: principalWhereClause,
        take: 10,
        orderBy: { created_at: 'desc' },
        include: {
          organization: {
            select: { name: true }
          },
          plan: {
            select: { name: true }
          },
          claims: {
            select: { amount: true },
            take: 1,
            orderBy: { created_at: 'desc' }
          }
        }
      })
    ]

    // Add underwriting statistics queries if user has access
    if (isSuperAdmin || isAdmin || isUnderwriterRole) {
      const today = new Date()
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(today.getDate() + 30)

      baseQueries.push(
        // Individual accounts (principals with INDIVIDUAL plan type)
        prisma.principalAccount.count({
          where: {
            ...principalWhereClause,
            plan: {
              plan_type: 'INDIVIDUAL'
            }
          }
        }),
        // Family accounts (principals with FAMILY plan type)
        prisma.principalAccount.count({
          where: {
            ...principalWhereClause,
            plan: {
              plan_type: 'FAMILY'
            }
          }
        }),
        // Total dependents
        prisma.dependent.count({
          where: dependentWhereClause
        }),
        // Male (principals + dependents)
        Promise.all([
          prisma.principalAccount.count({
            where: {
              ...principalWhereClause,
              gender: 'MALE'
            }
          }),
          prisma.dependent.count({
            where: {
              ...dependentWhereClause,
              gender: 'MALE'
            }
          })
        ]).then(([principals, dependents]) => principals + dependents),
        // Female (principals + dependents)
        Promise.all([
          prisma.principalAccount.count({
            where: {
              ...principalWhereClause,
              gender: 'FEMALE'
            }
          }),
          prisma.dependent.count({
            where: {
              ...dependentWhereClause,
              gender: 'FEMALE'
            }
          })
        ]).then(([principals, dependents]) => principals + dependents),
        // No Email (principals + dependents)
        Promise.all([
          prisma.principalAccount.count({
            where: {
              ...principalWhereClause,
              OR: [
                { email: null },
                { email: '' }
              ]
            }
          }),
          prisma.dependent.count({
            where: {
              ...dependentWhereClause,
              OR: [
                { email: null },
                { email: '' }
              ]
            }
          })
        ]).then(([principals, dependents]) => principals + dependents),
        // No Phone Number (principals + dependents)
        Promise.all([
          prisma.principalAccount.count({
            where: {
              ...principalWhereClause,
              OR: [
                { phone_number: null },
                { phone_number: '' }
              ]
            }
          }),
          prisma.dependent.count({
            where: {
              ...dependentWhereClause,
              OR: [
                { phone_number: null },
                { phone_number: '' }
              ]
            }
          })
        ]).then(([principals, dependents]) => principals + dependents),
        // No Hospital (principals only)
        prisma.principalAccount.count({
          where: {
            ...principalWhereClause,
            OR: [
              { primary_hospital: null },
              { primary_hospital: '' }
            ]
          }
        }),
        // About to Expire (end_date within 30 days)
        (() => {
          const today = new Date()
          const thirtyDaysFromNow = new Date()
          thirtyDaysFromNow.setDate(today.getDate() + 30)
          return prisma.principalAccount.count({
            where: {
              ...principalWhereClause,
              end_date: {
                gte: today,
                lte: thirtyDaysFromNow
              }
            }
          })
        })(),
        // No Pictures (principals + dependents)
        Promise.all([
          prisma.principalAccount.count({
            where: {
              ...principalWhereClause,
              OR: [
                { profile_picture: null },
                { profile_picture: '' }
              ]
            }
          }),
          prisma.dependent.count({
            where: {
              ...dependentWhereClause,
              OR: [
                { profile_picture: null },
                { profile_picture: '' }
              ]
            }
          })
        ]).then(([principals, dependents]) => principals + dependents)
      )
    }

    const results = await Promise.all(baseQueries)
    
    const [
      totalPrincipals,
      totalDependents,
      totalOrganizations,
      pendingInvoices,
      pendingClaims,
      enrolleeData,
      ...underwritingStats
    ] = results

    // Calculate total enrollees (principals + dependents)
    const totalEnrollees = totalPrincipals + totalDependents

    // Extract underwriting statistics if available
    const underwritingStatistics = (isSuperAdmin || isAdmin || isUnderwriterRole) && underwritingStats.length > 0 ? {
      individual: underwritingStats[0] || 0,
      family: underwritingStats[1] || 0,
      dependents: underwritingStats[2] || 0,
      male: underwritingStats[3] || 0,
      female: underwritingStats[4] || 0,
      noEmail: underwritingStats[5] || 0,
      noPhoneNumber: underwritingStats[6] || 0,
      noHospital: underwritingStats[7] || 0,
      aboutToExpire: underwritingStats[8] || 0,
      noPictures: underwritingStats[9] || 0
    } : null

    // Provider-specific approval code stats
    let approvalCodesApproved = 0
    let approvalCodesRejected = 0
    let approvalCodesPending = 0

    if (isProviderRole) {
      const providerFacilityName = user.provider?.facility_name
      if (providerFacilityName) {
        const [approvedCount, rejectedCount, pendingCount] = await Promise.all([
          prisma.approvalCode.count({
            where: {
              hospital: providerFacilityName,
              status: { in: ['APPROVED', 'PARTIAL'] }
            }
          }),
          prisma.approvalCode.count({
            where: {
              hospital: providerFacilityName,
              status: 'REJECTED'
            }
          }),
          prisma.approvalCode.count({
            where: {
              hospital: providerFacilityName,
              status: 'PENDING'
            }
          })
        ])
        approvalCodesApproved = approvedCount
        approvalCodesRejected = rejectedCount
        approvalCodesPending = pendingCount
      }
    }

    // Format the data for ERP dashboard
    const stats = {
      totalEnrollees,
      totalOrganizations: (isSuperAdmin || isAdmin) ? totalOrganizations : 0,
      pendingInvoices: (isSuperAdmin || isAdmin || isFinanceRole) ? pendingInvoices : 0,
      pendingClaims: (isSuperAdmin || isAdmin || isClaimsRole) ? pendingClaims : 0,
      approvalCodesApproved,
      approvalCodesRejected,
      approvalCodesPending,
      enrolleeData: enrolleeData.map((enrollee: { enrollee_id: string; first_name: string; last_name: string; organization: { name: string } | null; plan: { name: string } | null; status: string }) => ({
        id: enrollee.enrollee_id,
        name: `${enrollee.first_name} ${enrollee.last_name}`,
        organization: enrollee.organization?.name || 'Unknown',
        plan: enrollee.plan?.name || 'No Plan Assigned',
        status: enrollee.status === 'ACTIVE' ? 'Active' : 'Inactive'
      })),
      userRole, // Include user role for frontend logic
      accessLevel: {
        canViewOrganizations: isSuperAdmin || isAdmin,
        canViewInvoices: isSuperAdmin || isAdmin || isFinanceRole,
        canViewClaims: isSuperAdmin || isAdmin || isClaimsRole,
        canViewAllEnrollees: isSuperAdmin || isAdmin
      },
      underwritingStatistics // Include underwriting statistics
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}
