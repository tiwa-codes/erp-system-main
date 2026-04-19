import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import { notificationService } from '@/lib/notifications'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to view procurement
    const canView = await checkPermission(session.user.role as any, 'underwriting', 'procurement')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const department = searchParams.get('department')
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
        orderBy: { created_at: 'desc' }
      }),
      prisma.procurementInvoice.count({ where })
    ])

    return NextResponse.json({
      invoices,
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

    // Check permission to create procurement
    const canCreate = await checkPermission(session.user.role as any, 'underwriting', 'procurement')
    if (!canCreate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { service_type, department, amount, description } = body

    // Validate required fields
    if (!service_type || !department || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Generate invoice number
    const invoiceNumber = `UNDER-PROC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`

    // Create procurement invoice
    const invoice = await prisma.procurementInvoice.create({
      data: {
        invoice_number: invoiceNumber,
        service_type,
        department,
        amount: parseFloat(amount),
        description: description || null,
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
