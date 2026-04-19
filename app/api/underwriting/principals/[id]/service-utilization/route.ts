import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import { getEnrolleeUtilization } from "@/lib/underwriting/usage"
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to view principals
    const canView = await checkPermission(session.user.role as any, 'underwriting', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    // Get principal with plan details
    const principal = await prisma.principalAccount.findUnique({
      where: { id },
      select: {
        id: true,
        enrollee_id: true,
        old_utilization: true,
        utilization_imports: {
          select: {
            period_label: true,
            period_key: true,
            amount: true,
            created_at: true,
          },
          orderBy: { created_at: 'asc' },
        },
        dependents: {
          select: {
            old_utilization: true,
            utilization_imports: {
              select: {
                period_label: true,
                period_key: true,
                amount: true,
                created_at: true,
              },
              orderBy: { created_at: 'asc' },
            },
          }
        },
        plan: {
          select: {
            id: true,
            name: true,
            annual_limit: true
          }
        }
      }
    })

    if (!principal) {
      return NextResponse.json({ error: 'Principal not found' }, { status: 404 })
    }

    // Get all claims for this principal
    const claims = await prisma.claim.findMany({
      where: { principal_id: id },
      select: {
        id: true,
        claim_number: true,
        amount: true,
        status: true,
        submitted_at: true,
        provider: {
          select: {
            facility_name: true
          }
        }
      },
      orderBy: { submitted_at: 'desc' }
    })

    // Get all approval codes for this principal (using service_items relation)
    const approvalCodes = await prisma.approvalCode.findMany({
      where: {
        enrollee_id: id,
        is_deleted: false,
      },
      select: {
        id: true,
        approval_code: true,
        amount: true,
        diagnosis: true,
        hospital: true,
        status: true,
        created_at: true,
        service_items: {
          select: {
            id: true,
            service_name: true,
            service_amount: true,
            quantity: true,
            vetted_amount: true,
            category: true,
            is_deleted: true,
            added_at: true,
          }
        }
      },
      orderBy: { created_at: 'desc' }
    })

    // Real-time calculation using shared logic
    const utilization = await getEnrolleeUtilization(id)
    const annualLimit = Number(principal.plan?.annual_limit ?? 0)
    const totalUtilized = Number(utilization.amount_utilized ?? 0)
    const remainingBalance = Number(utilization.balance ?? 0)

    // Group services by name across all approval codes
    const serviceUtilization = approvalCodes.reduce((acc, code) => {
      if (code.status === 'REJECTED') return acc
      for (const item of code.service_items) {
        if (item.is_deleted) continue
        const serviceName = item.service_name || 'Unknown Service'
        const lineTotal = item.vetted_amount != null
          ? Number(item.vetted_amount)
          : Number(item.service_amount) * (Number(item.quantity) || 1)
        if (!acc[serviceName]) {
          acc[serviceName] = {
            service_name: serviceName,
            total_amount: 0,
            count: 0,
            last_used: item.added_at ?? code.created_at,
          }
        }
        acc[serviceName].total_amount += lineTotal
        acc[serviceName].count += 1
        const itemDate = new Date(item.added_at ?? code.created_at)
        if (itemDate > new Date(acc[serviceName].last_used)) {
          acc[serviceName].last_used = item.added_at ?? code.created_at
        }
      }

      // Fallback for older/manual records without structured service_items
      if (code.service_items.length === 0 && Number(code.amount) > 0) {
        const serviceName = code.services?.trim() || 'Manual Service'
        if (!acc[serviceName]) {
          acc[serviceName] = {
            service_name: serviceName,
            total_amount: 0,
            count: 0,
            last_used: code.created_at,
          }
        }
        acc[serviceName].total_amount += Number(code.amount)
        acc[serviceName].count += 1
        if (new Date(code.created_at) > new Date(acc[serviceName].last_used)) {
          acc[serviceName].last_used = code.created_at
        }
      }
      return acc
    }, {} as Record<string, any>)

    const serviceUtilizationArray = Object.values(serviceUtilization)
    const oldUtilization =
      Number(principal.old_utilization ?? 0) +
      principal.dependents.reduce((sum, dependent) => sum + Number(dependent.old_utilization ?? 0), 0)

    const importMap = new Map<string, {
      service_name: string
      total_amount: number
      count: number
      last_used: Date | null
      is_old_utilization: true
    }>()

    const allImports = [
      ...principal.utilization_imports,
      ...principal.dependents.flatMap((dependent) => dependent.utilization_imports),
    ]

    allImports.forEach((entry) => {
      const key = entry.period_key || entry.period_label
      const existing = importMap.get(key)
      const amount = Number(entry.amount ?? 0)

      if (existing) {
        existing.total_amount += amount
        existing.count += 1
        existing.last_used = entry.created_at
      } else {
        importMap.set(key, {
          service_name: entry.period_label,
          total_amount: amount,
          count: 1,
          last_used: entry.created_at,
          is_old_utilization: true,
        })
      }
    })

    const importedRows = Array.from(importMap.values())
    const importedTotal = importedRows.reduce((sum, entry) => sum + Number(entry.total_amount ?? 0), 0)
    const legacyUtilization = Math.max(0, oldUtilization - importedTotal)

    if (legacyUtilization > 0) {
      importedRows.unshift({
        service_name: 'Old Utilization',
        total_amount: legacyUtilization,
        count: 1,
        last_used: null,
        is_old_utilization: true,
      })
    }

    serviceUtilizationArray.unshift(...importedRows)

    return NextResponse.json({
      principal: {
        id: principal.id,
        enrollee_id: principal.enrollee_id,
        plan: principal.plan,
        old_utilization: oldUtilization,
      },
      summary: {
        annual_limit: annualLimit,
        total_utilized: totalUtilized,
        remaining_balance: remainingBalance,
        utilization_percentage: annualLimit > 0 ? (totalUtilized / annualLimit) * 100 : 0,
        old_utilization: oldUtilization,
      },
      claims: claims,
      approval_codes: approvalCodes,
      service_utilization: serviceUtilizationArray
    })
  } catch (error) {
    console.error('Error fetching service utilization:', error)
    return NextResponse.json(
      { error: 'Failed to fetch service utilization' },
      { status: 500 }
    )
  }
}
