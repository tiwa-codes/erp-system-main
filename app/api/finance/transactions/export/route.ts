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

    const canView = await checkPermission(session.user.role as any, 'finance', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const transactionType = searchParams.get('transaction_type') || ''
    const status = searchParams.get('status') || ''
    const startDate = searchParams.get('start_date') || ''
    const endDate = searchParams.get('end_date') || ''

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.OR = [
        { reference_id: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { principal: {
          OR: [
            { first_name: { contains: search, mode: 'insensitive' } },
            { last_name: { contains: search, mode: 'insensitive' } },
            { enrollee_id: { contains: search, mode: 'insensitive' } }
          ]
        }}
      ]
    }

    if (transactionType && transactionType !== 'all') {
      where.transaction_type = transactionType
    }

    if (status && status !== 'all') {
      where.status = status
    }

    if (startDate || endDate) {
      where.created_at = {}
      if (startDate) {
        where.created_at.gte = new Date(startDate)
      }
      if (endDate) {
        where.created_at.lte = new Date(endDate)
      }
    }

    const transactions = await prisma.financialTransaction.findMany({
      where,
      include: {
        principal: {
          select: {
            first_name: true,
            last_name: true,
            enrollee_id: true
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
    })

    // Convert to CSV format
    const csvHeaders = [
      'Transaction ID',
      'Transaction Type',
      'Amount',
      'Currency',
      'Reference ID',
      'Reference Type',
      'Description',
      'Principal Name',
      'Principal Enrollee ID',
      'Status',
      'Created By',
      'Created At'
    ]

    const csvRows = transactions.map(transaction => [
      transaction.id,
      transaction.transaction_type,
      transaction.amount.toString(),
      transaction.currency,
      transaction.reference_id,
      transaction.reference_type,
      transaction.description,
      transaction.principal ? `${transaction.principal.first_name} ${transaction.principal.last_name}` : '',
      transaction.principal?.enrollee_id || '',
      transaction.status,
      transaction.created_by ? `${transaction.created_by.first_name} ${transaction.created_by.last_name}` : '',
      transaction.created_at.toISOString()
    ])

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="financial-transactions-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error) {
    console.error('Error exporting financial transactions:', error)
    return NextResponse.json(
      { error: 'Failed to export financial transactions' },
      { status: 500 }
    )
  }
}
