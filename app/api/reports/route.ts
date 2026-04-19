import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to view reports
    const canView = await checkPermission(session.user.role as any, 'reports', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const filter = searchParams.get('filter')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!type || !filter) {
      return NextResponse.json({ error: 'Report type and filter are required' }, { status: 400 })
    }

    // Build date filter
    const dateFilter: any = {}
    if (from) {
      dateFilter.gte = new Date(from)
    }
    if (to) {
      dateFilter.lte = new Date(to)
    }

    let data: any[] = []
    let total = 0

    switch (type) {
      case 'UNDERWRITING':
        const underwritingResult = await getUnderwritingData(filter, dateFilter, search, page, limit)
        data = underwritingResult.data
        total = underwritingResult.total
        break
      case 'FINANCE':
        const financeResult = await getFinanceData(filter, dateFilter, search, page, limit)
        data = financeResult.data
        total = financeResult.total
        break
      case 'CALL_CENTRE':
        const callCentreResult = await getCallCentreData(filter, dateFilter, search, page, limit)
        data = callCentreResult.data
        total = callCentreResult.total
        break
      case 'CLAIMS':
        const claimsResult = await getClaimsData(filter, dateFilter, search, page, limit)
        data = claimsResult.data
        total = claimsResult.total
        break
      case 'PROVIDER_MANAGEMENT':
        const providerResult = await getProviderManagementData(filter, dateFilter, search, page, limit)
        data = providerResult.data
        total = providerResult.total
        break
      case 'TELEMEDICINE':
        const organization = searchParams.get('organization') || null
        const state = searchParams.get('state') || null
        const diagnosisFilter = searchParams.get('diagnosis') || null
        const telemedicineResult = await getTelemedicineData(filter, dateFilter, search, page, limit, organization, state, diagnosisFilter)
        data = telemedicineResult.data
        total = telemedicineResult.total
        break
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      type,
      filter
    })
  } catch (error) {
    console.error('Error fetching report data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch report data' },
      { status: 500 }
    )
  }
}

// Underwriting Reports
async function getUnderwritingData(filter: string, dateFilter: any, search?: string | null, page: number = 1, limit: number = 10) {
  switch (filter) {
    case 'Organizations':
      const [organizations, totalOrgs] = await Promise.all([
        prisma.organization.findMany({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } }
              ]
            })
          },
          include: {
            principal_accounts: {
              include: {
                dependents: true
              }
            }
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.organization.count({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } }
              ]
            })
          }
        })
      ])

      // Aggregate by date
      const orgDataByDate = organizations.reduce((acc, org) => {
        const date = org.created_at.toISOString().split('T')[0]
        if (!acc[date]) {
          acc[date] = {
            date,
            organizations_count: 0,
            principals_count: 0,
            dependents_count: 0,
            total_enrollees: 0
          }
        }
        acc[date].organizations_count += 1
        acc[date].principals_count += org.principal_accounts.length
        acc[date].dependents_count += org.principal_accounts.reduce((sum, principal) => sum + principal.dependents.length, 0)
        acc[date].total_enrollees += org.principal_accounts.length + org.principal_accounts.reduce((sum, principal) => sum + principal.dependents.length, 0)
        return acc
      }, {} as any)

      const orgData = Object.values(orgDataByDate).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

      return { data: orgData, total: Object.keys(orgDataByDate).length }

    case 'Principals':
      const [principals, totalPrincipals] = await Promise.all([
        prisma.principalAccount.findMany({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { first_name: { contains: search, mode: 'insensitive' } },
                { last_name: { contains: search, mode: 'insensitive' } },
                { enrollee_id: { contains: search, mode: 'insensitive' } }
              ]
            })
          },
          include: {
            organization: true
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.principalAccount.count({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { first_name: { contains: search, mode: 'insensitive' } },
                { last_name: { contains: search, mode: 'insensitive' } },
                { enrollee_id: { contains: search, mode: 'insensitive' } }
              ]
            })
          }
        })
      ])

      // Aggregate by date
      const principalDataByDate = principals.reduce((acc, principal) => {
        const date = principal.created_at.toISOString().split('T')[0]
        if (!acc[date]) {
          acc[date] = {
            date,
            principals_count: 0,
            males_count: 0,
            females_count: 0
          }
        }
        acc[date].principals_count += 1
        if (principal.gender === 'MALE') {
          acc[date].males_count += 1
        } else if (principal.gender === 'FEMALE') {
          acc[date].females_count += 1
        }
        return acc
      }, {} as any)

      const principalData = Object.values(principalDataByDate).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

      return { data: principalData, total: Object.keys(principalDataByDate).length }

    case 'Dependents':
      const [dependents, totalDependents] = await Promise.all([
        prisma.dependent.findMany({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { first_name: { contains: search, mode: 'insensitive' } },
                { last_name: { contains: search, mode: 'insensitive' } },
                { dependent_id: { contains: search, mode: 'insensitive' } }
              ]
            })
          },
          include: {
            principal: true
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.dependent.count({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { first_name: { contains: search, mode: 'insensitive' } },
                { last_name: { contains: search, mode: 'insensitive' } },
                { dependent_id: { contains: search, mode: 'insensitive' } }
              ]
            })
          }
        })
      ])

      // Aggregate by date
      const dependentDataByDate = dependents.reduce((acc, dependent) => {
        const date = dependent.created_at.toISOString().split('T')[0]
        if (!acc[date]) {
          acc[date] = {
            date,
            dependents_count: 0,
            males_count: 0,
            females_count: 0
          }
        }
        acc[date].dependents_count += 1
        if (dependent.gender === 'MALE') {
          acc[date].males_count += 1
        } else if (dependent.gender === 'FEMALE') {
          acc[date].females_count += 1
        }
        return acc
      }, {} as any)

      const dependentData = Object.values(dependentDataByDate).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

      return { data: dependentData, total: Object.keys(dependentDataByDate).length }

    case 'Enrollees':
      // Use PrincipalAccount as enrollees since there's no separate Enrollee model
      const [enrollees, totalEnrollees] = await Promise.all([
        prisma.principalAccount.findMany({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { first_name: { contains: search, mode: 'insensitive' } },
                { last_name: { contains: search, mode: 'insensitive' } },
                { enrollee_id: { contains: search, mode: 'insensitive' } }
              ]
            })
          },
          include: {
            plan: true,
            organization: true
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.principalAccount.count({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { first_name: { contains: search, mode: 'insensitive' } },
                { last_name: { contains: search, mode: 'insensitive' } },
                { enrollee_id: { contains: search, mode: 'insensitive' } }
              ]
            })
          }
        })
      ])

      // Aggregate by date
      const enrolleeDataByDate = enrollees.reduce((acc, enrollee) => {
        const date = enrollee.created_at.toISOString().split('T')[0]
        if (!acc[date]) {
          acc[date] = {
            date,
            enrollees_count: 0,
            plan_types: {} as any,
            statuses: {} as any
          }
        }
        acc[date].enrollees_count += 1
        
        // Count by plan type
        const planType = enrollee.plan?.name || 'N/A'
        acc[date].plan_types[planType] = (acc[date].plan_types[planType] || 0) + 1
        
        // Count by status
        const status = enrollee.account_type
        acc[date].statuses[status] = (acc[date].statuses[status] || 0) + 1
        
        return acc
      }, {} as any)

      const enrolleeData = Object.values(enrolleeDataByDate).map((item: any) => ({
        date: item.date,
        enrollees_count: item.enrollees_count,
        plan_type_breakdown: Object.entries(item.plan_types).map(([plan, count]) => `${plan}: ${count}`).join(', '),
        status_breakdown: Object.entries(item.statuses).map(([status, count]) => `${status}: ${count}`).join(', ')
      })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

      return { data: enrolleeData, total: Object.keys(enrolleeDataByDate).length }

    default:
      return { data: [], total: 0 }
  }
}

// Finance Reports
async function getFinanceData(filter: string, dateFilter: any, search?: string | null, page: number = 1, limit: number = 10) {
  switch (filter) {
    case 'Providers':
      const [payouts, totalPayouts] = await Promise.all([
        prisma.financialTransaction.findMany({
          where: {
            transaction_type: 'CLAIM_PAYOUT',
            created_at: dateFilter,
            ...(search && {
              OR: [
                { description: { contains: search, mode: 'insensitive' } },
                { reference_id: { contains: search, mode: 'insensitive' } }
              ]
            })
          },
          include: {
            created_by: {
              select: {
                first_name: true,
                last_name: true
              }
            }
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.financialTransaction.count({
          where: {
            transaction_type: 'CLAIM_PAYOUT',
            created_at: dateFilter,
            ...(search && {
              OR: [
                { description: { contains: search, mode: 'insensitive' } },
                { reference_id: { contains: search, mode: 'insensitive' } }
              ]
            })
          }
        })
      ])

      const payoutData = payouts.map(payout => ({
        hospital_name: payout.description || 'N/A',
        paid_by: payout.created_by ? `${payout.created_by.first_name} ${payout.created_by.last_name}` : 'System',
        payout_ready_date: payout.created_at.toISOString().split('T')[0],
        payment_date: payout.processed_at ? payout.processed_at.toISOString().split('T')[0] : 'Pending',
        amount: payout.amount
      }))

      return { data: payoutData, total: totalPayouts }

    default:
      return { data: [], total: 0 }
  }
}

// Call Centre Reports
async function getCallCentreData(filter: string, dateFilter: any, search?: string | null, page: number = 1, limit: number = 10) {
  switch (filter) {
    case 'Total codes generated':
      const [generatedCodes, totalGenerated] = await Promise.all([
        prisma.approvalCode.findMany({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { approval_code: { contains: search, mode: 'insensitive' } },
                { hospital: { contains: search, mode: 'insensitive' } },
                { enrollee_name: { contains: search, mode: 'insensitive' } }
              ]
            })
          },
          include: {
            generated_by: {
              select: {
                first_name: true,
                last_name: true
              }
            },
            enrollee: {
              select: {
                first_name: true,
                last_name: true
              }
            }
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.approvalCode.count({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { approval_code: { contains: search, mode: 'insensitive' } },
                { hospital: { contains: search, mode: 'insensitive' } },
                { enrollee_name: { contains: search, mode: 'insensitive' } }
              ]
            })
          }
        })
      ])

      const generatedCodeData = generatedCodes.map(code => ({
        date: code.created_at.toISOString().split('T')[0],
        codes_generated: 1,
        generated_by: code.generated_by ? `${code.generated_by.first_name} ${code.generated_by.last_name}` : 'System',
        provider_name: code.hospital || 'N/A'
      }))

      return { data: generatedCodeData, total: totalGenerated }

    case 'Total codes rejected':
      const [rejectedCodes, totalRejected] = await Promise.all([
        prisma.approvalCode.findMany({
          where: {
            status: 'REJECTED',
            updated_at: dateFilter,
            ...(search && {
              OR: [
                { approval_code: { contains: search, mode: 'insensitive' } },
                { hospital: { contains: search, mode: 'insensitive' } },
                { enrollee_name: { contains: search, mode: 'insensitive' } }
              ]
            })
          },
          include: {
            generated_by: {
              select: {
                first_name: true,
                last_name: true
              }
            },
            enrollee: {
              select: {
                first_name: true,
                last_name: true
              }
            }
          },
          orderBy: { updated_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.approvalCode.count({
          where: {
            status: 'REJECTED',
            updated_at: dateFilter,
            ...(search && {
              OR: [
                { approval_code: { contains: search, mode: 'insensitive' } },
                { hospital: { contains: search, mode: 'insensitive' } },
                { enrollee_name: { contains: search, mode: 'insensitive' } }
              ]
            })
          }
        })
      ])

      const rejectedCodeData = rejectedCodes.map(code => ({
        date: code.updated_at.toISOString().split('T')[0],
        codes_rejected: 1,
        rejected_by: 'System', // No generated_by relation in ApprovalCode
        provider_name: code.hospital || 'N/A'
      }))

      return { data: rejectedCodeData, total: totalRejected }

    case 'Utilization per Enrollee':
      // Use PrincipalAccount as enrollees since there's no separate Enrollee model
      const [enrolleeUtilization, totalEnrolleeUtil] = await Promise.all([
        prisma.principalAccount.findMany({
          where: {
            ...(search && {
              OR: [
                { first_name: { contains: search, mode: 'insensitive' } },
                { last_name: { contains: search, mode: 'insensitive' } },
                { enrollee_id: { contains: search, mode: 'insensitive' } }
              ]
            })
          },
          include: {
            plan: true
          },
          orderBy: { first_name: 'asc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.principalAccount.count({
          where: {
            ...(search && {
              OR: [
                { first_name: { contains: search, mode: 'insensitive' } },
                { last_name: { contains: search, mode: 'insensitive' } },
                { enrollee_id: { contains: search, mode: 'insensitive' } }
              ]
            })
          }
        })
      ])

      const enrolleeUtilData = enrolleeUtilization.map(enrollee => ({
        name: `${enrollee.first_name} ${enrollee.last_name}`,
        id: enrollee.enrollee_id,
        plan_type: enrollee.plan?.name || 'N/A',
        encounters: 0, // No claims relation in PrincipalAccount model
        costs: 0 // No claims relation in PrincipalAccount model
      }))

      return { data: enrolleeUtilData, total: totalEnrolleeUtil }

    case 'Utilization per Provider':
      const [providerUtilization, totalProviderUtil] = await Promise.all([
        prisma.provider.findMany({
          where: {
            ...(search && {
              facility_name: { contains: search, mode: 'insensitive' }
            })
          },
          include: {
            claims: {
              where: {
                created_at: dateFilter
              }
            }
          },
          orderBy: { facility_name: 'asc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.provider.count({
          where: {
            ...(search && {
              facility_name: { contains: search, mode: 'insensitive' }
            })
          }
        })
      ])

      const providerUtilData = providerUtilization.map(provider => ({
        provider_name: provider.facility_name,
        patient_volume: provider.claims.length,
        service_utilized: provider.claims.length, // Simplified
        number_of_claims: provider.claims.length,
        total_costs: provider.claims.reduce((sum, claim) => sum + Number(claim.amount || 0), 0)
      }))

      return { data: providerUtilData, total: totalProviderUtil }

    case 'Utilization per Organization':
      const [organizationUtilization, totalOrgUtil] = await Promise.all([
        prisma.organization.findMany({
          where: {
            ...(search && {
              name: { contains: search, mode: 'insensitive' }
            })
          },
          include: {
            principal_accounts: {
              include: {
                dependents: true
              }
            }
          },
          orderBy: { name: 'asc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.organization.count({
          where: {
            ...(search && {
              name: { contains: search, mode: 'insensitive' }
            })
          }
        })
      ])

      const orgUtilData = organizationUtilization.map(org => {
        const allEnrollees = org.principal_accounts
        const totalDependents = org.principal_accounts.reduce((sum, p) => sum + p.dependents.length, 0)
        
        return {
          organization_name: org.name,
          all_enrollees: allEnrollees.length + totalDependents,
          provider_utilization: 0, // No direct relation to providers
          service_utilization: 0, // No direct relation to services
          high_cost_cases: 0 // No direct relation to claims
        }
      })

      return { data: orgUtilData, total: totalOrgUtil }

    default:
      return { data: [], total: 0 }
  }
}

// Claims Reports
async function getClaimsData(filter: string, dateFilter: any, search?: string | null, page: number = 1, limit: number = 10) {
  switch (filter) {
    case 'Total Claims':
      const [totalClaims, totalCount] = await Promise.all([
        prisma.claim.findMany({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { claim_number: { contains: search, mode: 'insensitive' } },
                { principal: { first_name: { contains: search, mode: 'insensitive' } } }
              ]
            })
          },
          include: {
            principal: {
              select: {
                first_name: true,
                last_name: true
              }
            }
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.claim.count({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { claim_number: { contains: search, mode: 'insensitive' } },
                { principal: { first_name: { contains: search, mode: 'insensitive' } } }
              ]
            })
          }
        })
      ])

      // Group by date for daily totals
      const claimsByDate = totalClaims.reduce((acc: any, claim) => {
        const date = claim.created_at.toISOString().split('T')[0]
        if (!acc[date]) {
          acc[date] = {
            date,
            total_claims: 0,
            approved_claims: 0,
            rejected_claims: 0,
            total_amount: 0,
            average_amount: 0
          }
        }
        acc[date].total_claims += 1
        if (claim.status === 'APPROVED') {
          acc[date].approved_claims += 1
        } else if (claim.status === 'REJECTED') {
          acc[date].rejected_claims += 1
        }
        acc[date].total_amount += Number(claim.amount)
        return acc
      }, {})

      const totalClaimsData = Object.values(claimsByDate).map((dayData: any) => ({
        ...dayData,
        average_amount: dayData.total_claims > 0 ? dayData.total_amount / dayData.total_claims : 0
      }))

      return { data: totalClaimsData, total: totalCount }

    case 'Utilization by Organization':
      const [orgClaims, orgCount] = await Promise.all([
        prisma.claim.findMany({
          where: {
            created_at: dateFilter,
            ...(search && {
              principal: {
                organization: {
                  name: { contains: search, mode: 'insensitive' }
                }
              }
            })
          },
          include: {
            principal: {
              include: {
                organization: {
                  select: {
                    name: true
                  }
                }
              }
            }
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.claim.count({
          where: {
            created_at: dateFilter,
            ...(search && {
              principal: {
                organization: {
                  name: { contains: search, mode: 'insensitive' }
                }
              }
            })
          }
        })
      ])

      // Group by organization
      const claimsByOrg = orgClaims.reduce((acc: any, claim) => {
        const orgName = claim.principal?.organization?.name || 'Unknown'
        if (!acc[orgName]) {
          acc[orgName] = {
            organization_name: orgName,
            total_enrollees: new Set(),
            claims_count: 0,
            utilization_rate: 0,
            total_amount: 0,
            average_per_enrollee: 0
          }
        }
        acc[orgName].total_enrollees.add(claim.enrollee_id)
        acc[orgName].claims_count += 1
        acc[orgName].total_amount += Number(claim.amount)
        return acc
      }, {})

      const orgData = Object.values(claimsByOrg).map((orgData: any) => ({
        ...orgData,
        total_enrollees: orgData.total_enrollees.size,
        utilization_rate: orgData.total_enrollees.size > 0 ? (orgData.claims_count / orgData.total_enrollees.size) * 100 : 0,
        average_per_enrollee: orgData.total_enrollees.size > 0 ? orgData.total_amount / orgData.total_enrollees.size : 0
      }))

      return { data: orgData, total: orgCount }

    case 'Utilization by Enrollee':
      const [enrolleeClaims, enrolleeCount] = await Promise.all([
        prisma.claim.findMany({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { principal: { first_name: { contains: search, mode: 'insensitive' } } },
                { principal: { last_name: { contains: search, mode: 'insensitive' } } },
                { principal: { enrollee_id: { contains: search, mode: 'insensitive' } } }
              ]
            })
          },
          include: {
            principal: {
              include: {
                organization: {
                  select: {
                    name: true
                  }
                }
              }
            }
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.claim.count({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { principal: { first_name: { contains: search, mode: 'insensitive' } } },
                { principal: { last_name: { contains: search, mode: 'insensitive' } } },
                { principal: { enrollee_id: { contains: search, mode: 'insensitive' } } }
              ]
            })
          }
        })
      ])

      // Group by enrollee
      const claimsByEnrollee = enrolleeClaims.reduce((acc: any, claim) => {
        const enrolleeId = claim.enrollee_id
        if (!acc[enrolleeId]) {
          acc[enrolleeId] = {
            enrollee_name: `${claim.principal?.first_name || ''} ${claim.principal?.last_name || ''}`.trim(),
            enrollee_id: claim.principal?.enrollee_id || enrolleeId,
            organization: claim.principal?.organization?.name || 'Unknown',
            claims_count: 0,
            total_amount: 0,
            last_claim_date: claim.created_at.toISOString().split('T')[0]
          }
        }
        acc[enrolleeId].claims_count += 1
        acc[enrolleeId].total_amount += Number(claim.amount)
        // Update last claim date if this claim is more recent
        if (new Date(claim.created_at) > new Date(acc[enrolleeId].last_claim_date)) {
          acc[enrolleeId].last_claim_date = claim.created_at.toISOString().split('T')[0]
        }
        return acc
      }, {})

      const enrolleeData = Object.values(claimsByEnrollee)

      return { data: enrolleeData, total: enrolleeCount }

    case 'Vetter':
      const [vettedClaims, totalVetted] = await Promise.all([
        prisma.claim.findMany({
          where: {
            vetting_records: {
              some: {}
            },
            created_at: dateFilter,
            ...(search && {
              OR: [
                { claim_number: { contains: search, mode: 'insensitive' } },
                { principal: { first_name: { contains: search, mode: 'insensitive' } } }
              ]
            })
          },
          include: {
            vetting_records: {
              include: {
                vetter: {
                  select: {
                    first_name: true,
                    last_name: true
                  }
                }
              }
            }
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.claim.count({
          where: {
            vetting_records: {
              some: {}
            },
            created_at: dateFilter,
            ...(search && {
              OR: [
                { claim_number: { contains: search, mode: 'insensitive' } },
                { principal: { first_name: { contains: search, mode: 'insensitive' } } }
              ]
            })
          }
        })
      ])

      const vettedData = vettedClaims.map(claim => ({
        date: claim.created_at.toISOString().split('T')[0],
        claims_approved: claim.status === 'APPROVED' ? 1 : 0,
        claims_rejected: claim.status === 'REJECTED' ? 1 : 0,
        total_amount_approved: claim.status === 'APPROVED' ? Number(claim.amount) : 0
      }))

      return { data: vettedData, total: totalVetted }

    case 'Audit':
      const [auditedClaims, totalAudited] = await Promise.all([
        prisma.claim.findMany({
          where: {
            // Claims that have been audited
            id: {
              in: await prisma.claimAudit.findMany({
                select: { claim_id: true }
              }).then(audits => audits.map(a => a.claim_id))
            },
            created_at: dateFilter,
            ...(search && {
              OR: [
                { claim_number: { contains: search, mode: 'insensitive' } },
                { principal: { first_name: { contains: search, mode: 'insensitive' } } }
              ]
            })
          },
          include: {
            // Include audit information
            principal: {
              select: {
                first_name: true,
                last_name: true
              }
            }
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.claim.count({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { claim_number: { contains: search, mode: 'insensitive' } },
                { principal: { first_name: { contains: search, mode: 'insensitive' } } }
              ]
            })
          }
        })
      ])

      const auditedData = auditedClaims.map(claim => ({
        date: claim.created_at.toISOString().split('T')[0],
        vetted_claims_approved: claim.status === 'APPROVED' ? 1 : 0,
        vetted_claims_rejected: claim.status === 'REJECTED' ? 1 : 0,
        total_amount_approved: claim.status === 'APPROVED' ? Number(claim.amount) : 0
      }))

      return { data: auditedData, total: totalAudited }

    case 'Approval':
      const [approvedClaims, totalApproved] = await Promise.all([
        prisma.claim.findMany({
          where: {
            status: { in: ['APPROVED', 'REJECTED'] },
            created_at: dateFilter,
            ...(search && {
              OR: [
                { claim_number: { contains: search, mode: 'insensitive' } },
                { principal: { first_name: { contains: search, mode: 'insensitive' } } }
              ]
            })
          },
          include: {
            created_by: {
              select: {
                first_name: true,
                last_name: true
              }
            }
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.claim.count({
          where: {
            status: { in: ['APPROVED', 'REJECTED'] },
            created_at: dateFilter,
            ...(search && {
              OR: [
                { claim_number: { contains: search, mode: 'insensitive' } },
                { principal: { first_name: { contains: search, mode: 'insensitive' } } }
              ]
            })
          }
        })
      ])

      const approvedData = approvedClaims.map(claim => ({
        date: claim.created_at.toISOString().split('T')[0],
        audited_claims_approved: claim.status === 'APPROVED' ? 1 : 0,
        audited_claims_rejected: claim.status === 'REJECTED' ? 1 : 0,
        total_amount_approved: claim.status === 'APPROVED' ? Number(claim.amount) : 0
      }))

      return { data: approvedData, total: totalApproved }

    default:
      return { data: [], total: 0 }
  }
}

// Provider Management Reports
async function getProviderManagementData(filter: string, dateFilter: any, search?: string | null, page: number = 1, limit: number = 10) {
  switch (filter) {
    case 'Providers':
      const [providers, totalProviders] = await Promise.all([
        prisma.provider.findMany({
          where: {
            created_at: dateFilter,
            ...(search && {
              facility_name: { contains: search, mode: 'insensitive' }
            })
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.provider.count({
          where: {
            created_at: dateFilter,
            ...(search && {
              facility_name: { contains: search, mode: 'insensitive' }
            })
          }
        })
      ])

      const providerData = providers.map(provider => ({
        provider_name: provider.facility_name,
        approved_by: 'System', // No created_by_user relation in Provider model
        approval_date: provider.created_at.toISOString().split('T')[0],
        request_date: provider.created_at.toISOString().split('T')[0],
        status: provider.status || 'ACTIVE'
      }))

      return { data: providerData, total: totalProviders }

    case 'In-patient':
      const [inPatients, totalInPatients] = await Promise.all([
        prisma.inPatient.findMany({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { provider: { facility_name: { contains: search, mode: 'insensitive' } } },
                { patient_id: { contains: search, mode: 'insensitive' } }
              ]
            })
          },
          include: {
            provider: true
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.inPatient.count({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { provider: { facility_name: { contains: search, mode: 'insensitive' } } },
                { patient_id: { contains: search, mode: 'insensitive' } }
              ]
            })
          }
        })
      ])

      // Group by date and provider
      const groupedData = inPatients.reduce((acc: any, patient) => {
        const date = patient.created_at.toISOString().split('T')[0]
        const key = `${date}-${patient.provider.facility_name}`
        
        if (!acc[key]) {
          acc[key] = {
            date,
            provider_name: patient.provider.facility_name,
            enrollees_admitted: 0,
            enrollees_discharged: 0
          }
        }
        
        if (patient.status === 'ADMITTED') {
          acc[key].enrollees_admitted++
        } else if (patient.status === 'DISCHARGED') {
          acc[key].enrollees_discharged++
        }
        
        return acc
      }, {})

      const inPatientData = Object.values(groupedData)
      return { data: inPatientData, total: totalInPatients }

    default:
      return { data: [], total: 0 }
  }
}

// Telemedicine Reports
async function getTelemedicineData(
  filter: string,
  dateFilter: any,
  search?: string | null,
  page: number = 1,
  limit: number = 10,
  organization?: string | null,
  state?: string | null,
  diagnosisFilter?: string | null,
) {
  const hasDateFilter = Object.keys(dateFilter).length > 0
  const baseWhere: any = {}

  if (hasDateFilter) {
    baseWhere.scheduled_date = dateFilter
  }

  if (state) {
    baseWhere.state = { contains: state, mode: 'insensitive' }
  }

  if (organization) {
    baseWhere.enrollee = {
      organization: { name: { contains: organization, mode: 'insensitive' } }
    }
  }

  if (search) {
    baseWhere.OR = [
      { enrollee: { first_name: { contains: search, mode: 'insensitive' } } },
      { enrollee: { last_name: { contains: search, mode: 'insensitive' } } },
      { enrollee: { enrollee_id: { contains: search, mode: 'insensitive' } } },
    ]
  }

  switch (filter) {
    case 'Appointments':
      // Fetch all appointments in period (minimal fields) to compute per-org percentages
      const allForPeriod = await prisma.telemedicineAppointment.findMany({
        where: hasDateFilter ? { scheduled_date: dateFilter } : {},
        select: {
          enrollee: { select: { organization: { select: { name: true } } } },
        },
      })
      const grandTotal = allForPeriod.length
      const orgCounts: Record<string, number> = {}
      for (const a of allForPeriod) {
        const orgName = a.enrollee?.organization?.name || 'Unknown'
        orgCounts[orgName] = (orgCounts[orgName] || 0) + 1
      }

      const [appointments, totalAppointments] = await Promise.all([
        prisma.telemedicineAppointment.findMany({
          where: baseWhere,
          include: {
            enrollee: {
              select: {
                first_name: true,
                last_name: true,
                enrollee_id: true,
                organization: { select: { name: true } },
              },
            },
            dependent: {
              select: { first_name: true, last_name: true, dependent_id: true },
            },
          },
          orderBy: { scheduled_date: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.telemedicineAppointment.count({ where: baseWhere }),
      ])

      const appointmentData = appointments.map(appointment => {
        const isDependent = !!appointment.dependent_id && !!appointment.dependent
        const patientName = isDependent
          ? `${appointment.dependent!.first_name || ''} ${appointment.dependent!.last_name || ''}`.trim()
          : appointment.enrollee
            ? `${appointment.enrollee.first_name || ''} ${appointment.enrollee.last_name || ''}`.trim()
            : 'N/A'
        const patientId = isDependent
          ? appointment.dependent!.dependent_id
          : appointment.enrollee?.enrollee_id || 'N/A'
        const orgName = appointment.enrollee?.organization?.name || 'Unknown'
        const pct = grandTotal > 0 ? ((orgCounts[orgName] || 0) / grandTotal * 100).toFixed(1) + '%' : 'N/A'

        return {
          date: appointment.scheduled_date.toISOString().split('T')[0],
          enrollee_name: patientName || 'N/A',
          enrollee_id: patientId,
          patient_type: isDependent ? 'Dependent' : 'Principal',
          organization: orgName,
          appointment_type: appointment.appointment_type || 'N/A',
          specialization: appointment.specialization || 'N/A',
          state: appointment.state || 'N/A',
          lga: appointment.lga || 'N/A',
          status: appointment.status || 'N/A',
          percentage: pct,
        }
      })

      return { data: appointmentData, total: totalAppointments }

    case 'Lab Orders':
      const labWhere: any = {}
      if (hasDateFilter) {
        labWhere.created_at = dateFilter
      }
      if (search) {
        labWhere.OR = [
          { test_name: { contains: search, mode: 'insensitive' } },
          { appointment: { enrollee: { first_name: { contains: search, mode: 'insensitive' } } } },
          { appointment: { enrollee: { last_name: { contains: search, mode: 'insensitive' } } } }
        ]
      }
      
      const [labOrders, totalLabOrders] = await Promise.all([
        prisma.labOrder.findMany({
          where: labWhere,
          include: {
            appointment: {
              include: {
                enrollee: {
                  select: {
                    first_name: true,
                    last_name: true
                  }
                }
              }
            },
            facility: {
              select: {
                facility_name: true
              }
            }
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.labOrder.count({
          where: labWhere
        })
      ])

      const labOrderData = labOrders.map(order => ({
        date: order.created_at.toISOString().split('T')[0],
        enrollee_name: order.appointment?.enrollee
          ? `${order.appointment.enrollee.first_name || ''} ${order.appointment.enrollee.last_name || ''}`.trim() || 'N/A'
          : 'N/A',
        test_name: order.test_name || 'N/A',
        facility_name: order.facility?.facility_name || 'N/A',
        status: order.status || 'N/A',
        amount: order.amount || 0
      }))

      return { data: labOrderData, total: totalLabOrders }

    case 'Radiology Orders':
      const [radiologyOrders, totalRadiologyOrders] = await Promise.all([
        prisma.radiologyOrder.findMany({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { test_name: { contains: search, mode: 'insensitive' } },
                { appointment: { enrollee: { first_name: { contains: search, mode: 'insensitive' } } } },
                { appointment: { enrollee: { last_name: { contains: search, mode: 'insensitive' } } } }
              ]
            })
          },
          include: {
            appointment: {
              include: {
                enrollee: {
                  select: {
                    first_name: true,
                    last_name: true
                  }
                }
              }
            },
            facility: {
              select: {
                facility_name: true
              }
            }
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.radiologyOrder.count({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { test_name: { contains: search, mode: 'insensitive' } },
                { appointment: { enrollee: { first_name: { contains: search, mode: 'insensitive' } } } },
                { appointment: { enrollee: { last_name: { contains: search, mode: 'insensitive' } } } }
              ]
            })
          }
        })
      ])

      const radiologyOrderData = radiologyOrders.map(order => ({
        date: order.created_at.toISOString().split('T')[0],
        enrollee_name: `${order.appointment.enrollee.first_name} ${order.appointment.enrollee.last_name}`,
        test_name: order.test_name,
        facility_name: order.facility?.facility_name || 'N/A',
        status: order.status,
        amount: order.amount || 0
      }))

      return { data: radiologyOrderData, total: totalRadiologyOrders }

    case 'Pharmacy Orders':
      const [pharmacyOrders, totalPharmacyOrders] = await Promise.all([
        prisma.pharmacyOrder.findMany({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { medication: { contains: search, mode: 'insensitive' } },
                { appointment: { enrollee: { first_name: { contains: search, mode: 'insensitive' } } } },
                { appointment: { enrollee: { last_name: { contains: search, mode: 'insensitive' } } } }
              ]
            })
          },
          include: {
            appointment: {
              include: {
                enrollee: {
                  select: {
                    first_name: true,
                    last_name: true
                  }
                }
              }
            },
            facility: {
              select: {
                facility_name: true
              }
            }
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.pharmacyOrder.count({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { medication: { contains: search, mode: 'insensitive' } },
                { appointment: { enrollee: { first_name: { contains: search, mode: 'insensitive' } } } },
                { appointment: { enrollee: { last_name: { contains: search, mode: 'insensitive' } } } }
              ]
            })
          }
        })
      ])

      const pharmacyOrderData = pharmacyOrders.map(order => ({
        date: order.created_at.toISOString().split('T')[0],
        enrollee_name: `${order.appointment.enrollee.first_name} ${order.appointment.enrollee.last_name}`,
        medication: order.medication,
        facility_name: order.facility?.facility_name || 'N/A',
        status: order.status,
        amount: order.amount || 0
      }))

      return { data: pharmacyOrderData, total: totalPharmacyOrders }

    case 'Clinical Encounters':
      const encounterWhere: any = { ...(hasDateFilter ? { created_at: dateFilter } : {}) }
      const encounterOrConditions: any[] = []
      if (search) {
        encounterOrConditions.push(
          { diagnosis: { contains: search, mode: 'insensitive' } },
          { appointment: { enrollee: { first_name: { contains: search, mode: 'insensitive' } } } },
          { appointment: { enrollee: { last_name: { contains: search, mode: 'insensitive' } } } },
        )
      }
      if (diagnosisFilter) {
        encounterWhere.diagnosis = { contains: diagnosisFilter, mode: 'insensitive' }
      }
      if (organization) {
        encounterWhere.appointment = {
          enrollee: { organization: { name: { contains: organization, mode: 'insensitive' } } },
        }
      }
      if (encounterOrConditions.length > 0) {
        encounterWhere.OR = encounterOrConditions
      }

      const [encounters, totalEncounters] = await Promise.all([
        prisma.clinicalEncounter.findMany({
          where: encounterWhere,
          include: {
            appointment: {
              include: {
                enrollee: {
                  select: {
                    first_name: true,
                    last_name: true
                  }
                }
              }
            },
            created_by: {
              select: {
                first_name: true,
                last_name: true
              }
            }
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.clinicalEncounter.count({
          where: {
            created_at: dateFilter,
            ...(search && {
              OR: [
                { diagnosis: { contains: search, mode: 'insensitive' } },
                { appointment: { enrollee: { first_name: { contains: search, mode: 'insensitive' } } } },
                { appointment: { enrollee: { last_name: { contains: search, mode: 'insensitive' } } } }
              ]
            })
          }
        })
      ])

      const encounterData = encounters.map(encounter => ({
        date: encounter.created_at.toISOString().split('T')[0],
        enrollee_name: `${encounter.appointment.enrollee.first_name} ${encounter.appointment.enrollee.last_name}`,
        diagnosis: encounter.diagnosis || 'N/A',
        created_by: `${encounter.created_by.first_name} ${encounter.created_by.last_name}`,
        status: encounter.status
      }))

      return { data: encounterData, total: totalEncounters }

    default:
      return { data: [], total: 0 }
  }
}
