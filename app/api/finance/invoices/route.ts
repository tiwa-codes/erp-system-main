import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canAccess = await checkPermission(session.user.role as any, 'finance', 'view') || 
                      await checkPermission(session.user.role as any, 'hr', 'procurement')
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const skip = (page - 1) * limit

    // Build where clause
    const whereClause: any = {}

    if (search) {
      whereClause.OR = [
        { invoice_number: { contains: search, mode: 'insensitive' } },
        { enrollee_name: { contains: search, mode: 'insensitive' } },
        { enrollee_id: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (status && status !== 'all') {
      whereClause.status = status
    }

    if (startDate && endDate) {
      whereClause.created_at = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    // Get invoices
    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: {
        plan: {
          select: {
            name: true,
            plan_type: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      skip,
      take: limit
    })

    // Get total count
    const total = await prisma.invoice.count({
      where: whereClause
    })

    const mappedInvoices = invoices.map(invoice => ({
      id: invoice.id,
      date: invoice.created_at.toISOString(),
      enrollee_id: invoice.enrollee_id || 'N/A',
      enrollee_name: invoice.enrollee_name || 'N/A',
      invoice_number: invoice.invoice_number,
      plan_type: invoice.plan_type || invoice.plan?.plan_type || 'N/A',
      plan_amount: invoice.plan_amount,
      status: invoice.status,
      due_date: invoice.due_date?.toISOString(),
      paid_at: invoice.paid_at?.toISOString()
    }))

    const pagination = {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }

    return NextResponse.json({ 
      invoices: mappedInvoices,
      pagination 
    })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
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

    const canAccess = await checkPermission(session.user.role as any, 'finance', 'add') || 
                      await checkPermission(session.user.role as any, 'hr', 'add')
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { enrollee_id, enrollee_name, plan_id, plan_type, plan_amount, due_date } = body

    // Generate invoice number
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`

    const invoice = await prisma.invoice.create({
      data: {
        invoice_number: invoiceNumber,
        enrollee_id,
        enrollee_name,
        plan_id,
        plan_type,
        plan_amount: parseFloat(plan_amount),
        due_date: due_date ? new Date(due_date) : null,
        status: 'PENDING'
      }
    })

    return NextResponse.json({ invoice })
  } catch (error) {
    console.error('Error creating invoice:', error)
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    )
  }
}
