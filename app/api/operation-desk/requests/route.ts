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

    const canView = await checkPermission(session.user.role as any, 'operation-desk', 'view', 'procurement-bill')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const startDate = searchParams.get('start_date') || ''
    const endDate = searchParams.get('end_date') || ''
    const department = searchParams.get('department') || ''
    const status = searchParams.get('status') || ''

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      status: 'PENDING_OPERATIONS' // Only show requests pending operations approval
    }
    
    if (search) {
      where.OR = [
        { service_type: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
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

    if (department && department !== 'all') {
      where.department = { contains: department, mode: 'insensitive' }
    }

    if (status && status !== 'all') {
      where.status = status
    }

    const [requests, total] = await Promise.all([
      prisma.procurementInvoice.findMany({
        where,
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
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.procurementInvoice.count({ where })
    ])

    // Transform data to match UI requirements
    const transformedRequests = requests.map(request => ({
      id: request.id,
      date: request.created_at,
      invoice_id: `INV${request.id.slice(-7)}`,
      service: request.service_type,
      department: request.department,
      amount: Number(request.amount),
      status: request.status,
      created_at: request.created_at,
      requested_by: request.created_by ? 
        `${request.created_by.first_name} ${request.created_by.last_name}` : 
        'Unknown',
      description: request.description,
      // Include comment history for review
      dept_oversight_comment: request.dept_oversight_comment,
      dept_oversight_by: request.dept_oversight_by,
      dept_oversight_at: request.dept_oversight_at,
      operations_comment: request.operations_comment,
      operations_by: request.operations_by,
      operations_at: request.operations_at,
      executive_comment: request.executive_comment,
      executive_by: request.executive_by,
      executive_at: request.executive_at,
      attachment_url: request.attachment_url,
      attachment_name: request.attachment_name
    }))

    return NextResponse.json({
      requests: transformedRequests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching operation desk requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    )
  }
}
