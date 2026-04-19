import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Find the dependent and their principal
    const dependent = await prisma.dependent.findUnique({
      where: { id },
      include: {
        utilization_imports: {
          orderBy: { created_at: 'asc' }
        },
        principal: {
          include: {
            plan: true
          }
        }
      }
    })

    if (!dependent) {
      return NextResponse.json({ error: 'Dependent not found' }, { status: 404 })
    }

    if (!dependent.principal?.plan) {
      return NextResponse.json({ 
        error: 'No plan associated with this dependent' 
      }, { status: 404 })
    }

    const plan = dependent.principal.plan
    const annualLimit = plan.annual_limit || 0
    const oldUtilization = Number(dependent.old_utilization ?? 0)

    // Get claims for this dependent
    const claims = await prisma.claim.findMany({
      where: {
        enrollee_id: dependent.dependent_id
      }
    })

    // Get approval codes for this dependent
    const approvalCodes = await prisma.approvalCode.findMany({
      where: {
        enrollee_name: `${dependent.first_name} ${dependent.last_name}`,
        enrollee_id: dependent.dependent_id
      }
    })

    // Calculate service utilization
    const serviceUtilizationMap = new Map()

    // Process claims (claims don't have services, just amounts)
    claims.forEach(claim => {
      const serviceName = 'General Claim'
      const amount = parseFloat(claim.amount.toString()) || 0
      
      if (serviceUtilizationMap.has(serviceName)) {
        const existing = serviceUtilizationMap.get(serviceName)
        existing.count += 1
        existing.total_amount += amount
        existing.last_used = new Date(claim.created_at)
      } else {
        serviceUtilizationMap.set(serviceName, {
          service_name: serviceName,
          count: 1,
          total_amount: amount,
          last_used: new Date(claim.created_at)
        })
      }
    })

    // Process approval codes
    approvalCodes.forEach(code => {
      if (code.services) {
        let services = []
        try {
          services = typeof code.services === 'string' ? JSON.parse(code.services) : code.services
        } catch (e) {
          // If parsing fails, treat as single service
          services = [{ service_name: code.services, amount: code.amount || 0 }]
        }

        services.forEach((service: any) => {
          const serviceName = service.service_name || service.name || 'Unknown Service'
          const amount = parseFloat(service.amount) || 0
          
          if (serviceUtilizationMap.has(serviceName)) {
            const existing = serviceUtilizationMap.get(serviceName)
            existing.count += 1
            existing.total_amount += amount
            if (new Date(code.created_at) > existing.last_used) {
              existing.last_used = new Date(code.created_at)
            }
          } else {
            serviceUtilizationMap.set(serviceName, {
              service_name: serviceName,
              count: 1,
              total_amount: amount,
              last_used: new Date(code.created_at)
            })
          }
        })
      }
    })

    const service_utilization = Array.from(serviceUtilizationMap.values())
    const importedRows = dependent.utilization_imports.map((entry) => ({
      service_name: entry.period_label,
      count: 1,
      total_amount: Number(entry.amount ?? 0),
      last_used: entry.created_at,
      is_old_utilization: true,
    }))
    const importedTotal = importedRows.reduce((sum, entry) => sum + Number(entry.total_amount ?? 0), 0)
    const legacyUtilization = Math.max(0, oldUtilization - importedTotal)

    if (legacyUtilization > 0) {
      importedRows.unshift({
        service_name: 'Old Utilization',
        count: 1,
        total_amount: legacyUtilization,
        last_used: null,
        is_old_utilization: true,
      })
    }

    service_utilization.unshift(...importedRows)

    const total_utilized = service_utilization.reduce((sum, service) => sum + service.total_amount, 0)
    const remaining_balance = Math.max(0, annualLimit - total_utilized)
    const utilization_percentage = annualLimit > 0 ? (total_utilized / annualLimit) * 100 : 0

    const summary = {
      annual_limit: annualLimit,
      total_utilized,
      remaining_balance,
      utilization_percentage,
      old_utilization: oldUtilization,
    }

    return NextResponse.json({
      summary,
      service_utilization
    })
  } catch (error) {
    console.error('Error fetching dependent service utilization:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch service utilization',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
