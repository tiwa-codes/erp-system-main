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

    const canView = await checkPermission(session.user.role as any, 'provider', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get user's provider information
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { 
        provider: true,
        role: true 
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const startDate = searchParams.get('start_date') || ''
    const endDate = searchParams.get('end_date') || ''

    // Build where clause for provider requests - filter by user's provider
    const where: any = {}
    
    // If user is a PROVIDER role (not ADMIN/SUPER_ADMIN), only show requests for their provider
    if (user.role?.name === 'PROVIDER' && user.provider_id) {
      where.provider_id = user.provider_id
    }
    
    if (search) {
      where.OR = [
        { hospital: { contains: search, mode: 'insensitive' } },
        { services: { contains: search, mode: 'insensitive' } },
        { enrollee: { 
          OR: [
            { enrollee_id: { contains: search, mode: 'insensitive' } },
            { first_name: { contains: search, mode: 'insensitive' } },
            { last_name: { contains: search, mode: 'insensitive' } }
          ]
        }},
        { provider: { facility_name: { contains: search, mode: 'insensitive' } } }
      ]
    }

    if (status && status !== 'all') {
      if (status === 'PENDING') {
        where.status = 'PENDING'
      } else if (status === 'APPROVED') {
        where.status = 'APPROVED'
      }
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

    // Get all provider requests for export
    const providerRequests = await prisma.providerRequest.findMany({
      where,
      include: {
        provider: {
          select: {
            id: true,
            facility_name: true,
            facility_type: true
          }
        },
        enrollee: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    })

    // Get approval codes for approved requests
    const approvalCodesWhere: any = {
      enrollee_id: { in: providerRequests.map(req => req.enrollee_id) },
      hospital: { in: providerRequests.map(req => req.hospital) }
    }

    // If user is a PROVIDER role, filter approval codes by their hospital
    if (user.role?.name === 'PROVIDER' && user.provider_id && user.provider) {
      approvalCodesWhere.hospital = user.provider.facility_name
    }

    const approvalCodes = await prisma.approvalCode.findMany({
      where: approvalCodesWhere,
      select: {
        id: true,
        approval_code: true,
        enrollee_id: true,
        hospital: true,
        created_at: true
      }
    })

    // Transform to CSV format
    const csvData = [
      [
        'Approval Code',
        'Enrollee Name', 
        'Enrollee ID',
        'Hospital',
        'Services',
        'Status',
        'Date'
      ],
      ...providerRequests.map(request => {
        const matchingApprovalCode = approvalCodes.find(code => 
          code.enrollee_id === request.enrollee_id && 
          code.hospital === request.hospital &&
          new Date(code.created_at) >= new Date(request.created_at)
        )

        const approvalCodeValue = request.status === 'APPROVED' 
          ? (matchingApprovalCode?.approval_code || 'Generated Code')
          : 'Pending Approval'

        return [
          approvalCodeValue,
          `${request.enrollee.first_name} ${request.enrollee.last_name}`,
          request.enrollee.enrollee_id,
          request.provider.facility_name,
          request.services ? JSON.parse(request.services) : 'General Service',
          request.status === 'APPROVED' ? 'APPROVED' : 'PENDING',
          new Date(request.created_at).toLocaleDateString()
        ]
      })
    ]

    // Convert to CSV string
    const csvString = csvData.map(row => 
      row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n')

    return new NextResponse(csvString, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="provider-approval-codes-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })

  } catch (error) {
    console.error('Error exporting provider approval codes:', error)
    return NextResponse.json(
      { error: 'Failed to export provider approval codes' },
      { status: 500 }
    )
  }
}
