import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import { notificationService } from '@/lib/notifications'

const PROCUREMENT_MODULES = ['hr', 'claims', 'provider', 'underwriting', 'call-centre', 'finance'] as const

async function hasProcurementAccess(role: string) {
  const checks = await Promise.all(
    PROCUREMENT_MODULES.map((module) => checkPermission(role as any, module, 'procurement'))
  )

  return checks.some(Boolean)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const department = searchParams.get('department')
    const stage = searchParams.get('stage')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Build where clause
    const where: any = {}

    // Non-admin users only see their own procurement requests
    const canSeeAll = ['SUPER_ADMIN', 'ADMIN', 'FINANCE_OFFICER'].includes(session.user.role as string)
    if (!canSeeAll) {
      where.created_by_id = session.user.id
    }
    
    if (search) {
      where.OR = [
        { invoice_number: { contains: search, mode: 'insensitive' } },
        { service_type: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
        { generated_by: { contains: search, mode: 'insensitive' } }
      ]
    }
    
    if (status && status !== 'all') {
      where.status = status
    }
    
    if (department && department !== 'all') {
      where.department = department
    }

    // Finance should only see invoices that have reached finance workflow stage.
    if (stage === 'finance') {
      const financeStageFilter = {
        OR: [
          { status: { in: ['PENDING_FINANCE', 'APPROVED', 'PAID'] } },
          // Rejected items are shown only if they reached executive/finance stage first.
          { status: 'REJECTED', executive_at: { not: null } }
        ]
      }

      if (!where.AND) {
        where.AND = []
      }
      where.AND.push(financeStageFilter)
    }
    
    if (startDate && endDate) {
      where.created_at = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    // Get procurement invoices with pagination
    const [invoices, total] = await Promise.all([
      prisma.procurementInvoice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          created_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          },
          dept_oversight_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          },
          operations_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          },
          executive_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          }
        }
      }),
      prisma.procurementInvoice.count({ where })
    ])

    // Keep HR status in sync with finance payout status.
    // Some finance flows update financial transactions without updating procurementInvoice.status.
    let normalizedInvoices = invoices
    try {
      const invoiceNumbers = invoices.map((invoice) => invoice.invoice_number).filter(Boolean)
      const invoiceIds = invoices.map((invoice) => invoice.id).filter(Boolean)
      const transactions = invoiceNumbers.length || invoiceIds.length
        ? await prisma.financialTransaction.findMany({
            where: {
              reference_type: 'PROCUREMENT_INVOICE',
              reference_id: { in: [...invoiceNumbers, ...invoiceIds] }
            },
            select: {
              reference_id: true,
              status: true,
              processed_at: true,
              created_at: true
            },
            orderBy: {
              created_at: 'desc'
            }
          })
        : []

      const latestTransactionByReference = new Map<string, { status: string }>()
      const invoiceNumberById = new Map<string, string>()
      for (const invoice of invoices) {
        invoiceNumberById.set(invoice.id, invoice.invoice_number)
      }

      for (const tx of transactions) {
        const normalizedReference = invoiceNumberById.get(tx.reference_id) || tx.reference_id
        if (!latestTransactionByReference.has(normalizedReference)) {
          latestTransactionByReference.set(normalizedReference, { status: tx.status })
        }
      }

      normalizedInvoices = invoices.map((invoice) => {
        const tx = latestTransactionByReference.get(invoice.invoice_number)
        const isFinancePaid = tx?.status === 'PAID' || tx?.status === 'PROCESSED'

        return {
          ...invoice,
          status: isFinancePaid ? 'PAID' : invoice.status
        }
      })
    } catch (syncError) {
      // Never block invoice listing if paid-sync lookup fails.
      console.error('Procurement finance sync failed; returning base invoices:', syncError)
    }

    return NextResponse.json({
      invoices: normalizedInvoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching procurement invoices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch procurement invoices' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { service_type, department, amount, description, attachment } = body

    // Validate required fields
    if (!service_type || !department || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Generate invoice number
    const invoiceNumber = `PROC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`

    // Create procurement invoice
    const invoice = await prisma.procurementInvoice.create({
      data: {
        invoice_number: invoiceNumber,
        service_type,
        department,
        amount: parseFloat(amount),
        description: description || null,
        attachment_url: attachment?.url || null,
        attachment_name: attachment?.name || null,
        generated_by: session.user.name,
        status: 'PENDING',
        created_by_id: session.user.id
      }
    })

    // Create financial transaction for payout
    await prisma.financialTransaction.create({
      data: {
        transaction_type: 'PROCUREMENT_PAYOUT',
        amount: parseFloat(amount),
        description: `Procurement payout for ${service_type} - ${department}`,
        reference_id: invoiceNumber,
        reference_type: 'PROCUREMENT_INVOICE',
        status: 'PENDING',
        created_by_id: session.user.id
      }
    })

    // Log the procurement invoice creation
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PROCUREMENT_INVOICE_CREATED',
        resource: 'procurement_invoice',
        resource_id: invoice.id,
        new_values: {
          invoice_number: invoiceNumber,
          service_type,
          department,
          amount: parseFloat(amount)
        }
      }
    })

    // Trigger email notification to SUPERADMIN
    try {
      await notificationService.sendProcurementBillNotification(invoice)
    } catch (notifError) {
      console.error('Failed to send procurement notification:', notifError)
    }

    return NextResponse.json({
      success: true,
      data: invoice,
      message: 'Procurement invoice created successfully'
    })
  } catch (error) {
    console.error('Error creating procurement invoice:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create procurement invoice',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
