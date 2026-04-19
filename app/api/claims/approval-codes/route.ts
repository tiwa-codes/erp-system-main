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

    const canView = await checkPermission(session.user.role as any, 'claims', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const startDate = searchParams.get('start_date') || ''
    const endDate = searchParams.get('end_date') || ''

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.OR = [
        { claim_number: { contains: search, mode: 'insensitive' } },
        { principal: { 
          OR: [
            { first_name: { contains: search, mode: 'insensitive' } },
            { last_name: { contains: search, mode: 'insensitive' } }
          ]
        }},
        { provider: { facility_name: { contains: search, mode: 'insensitive' } } }
      ]
    }

    if (status && status !== 'all') {
      where.status = status
    }

    if (startDate || endDate) {
      where.submitted_at = {}
      if (startDate) {
        where.submitted_at.gte = new Date(startDate)
      }
      if (endDate) {
        where.submitted_at.lte = new Date(endDate)
      }
    }

    const [claims, total] = await Promise.all([
      prisma.claim.findMany({
        where,
        include: {
          principal: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              enrollee_id: true
            }
          },
          provider: {
            select: {
              id: true,
              facility_name: true,
              facility_type: true
            }
          },
          created_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          }
        },
        orderBy: { submitted_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.claim.count({ where })
    ])

    // Transform data to match approval code UI requirements
    const approvalCodes = claims.map(claim => ({
      id: claim.id,
      approval_code: claim.claim_number, // Using claim_number as approval code
      hospital: claim.provider?.facility_name || 'Unknown',
      services: 'General Service', // Default since description field doesn't exist
      status: claim.status === 'APPROVED' ? 'APPROVED' : 'PENDING',
      date: claim.submitted_at,
      claim_id: claim.id,
      provider_id: claim.provider_id,
      provider: claim.provider,
      enrollee: claim.principal
        ? {
            id: claim.principal.id,
            first_name: claim.principal.first_name,
            last_name: claim.principal.last_name,
            enrollee_id: claim.principal.enrollee_id
          }
        : null
    }))

    return NextResponse.json({
      approval_codes: approvalCodes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching approval codes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch approval codes' },
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

    const canAdd = await checkPermission(session.user.role as any, 'claims', 'add')
    if (!canAdd) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      enrollee_id,
      principal_id,
      provider_id,
      services,
      amount,
      diagnosis,
      diagnosis_not_on_list
    } = body

    if (!enrollee_id || !provider_id || !services || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Generate unique approval code
    const approvalCode = `APR/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(Date.now()).slice(-6)}`

    const claimAmount = parseFloat(amount)
    // Create claim with approval code
    const newApprovalCode = await prisma.claim.create({
      data: {
        claim_number: approvalCode,
        enrollee_id,
        principal_id: principal_id || null,
        provider_id,
        claim_type: 'MEDICAL',
        amount: claimAmount,
        original_amount: claimAmount, // Set original amount from provider
        status: 'SUBMITTED',
        current_stage: 'vetter1', // Start at Vetter 1 stage
        created_by_id: session.user.id,
      },
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'APPROVAL_CODE_CREATE',
        resource: 'approval_code',
        resource_id: newApprovalCode.id,
        new_values: newApprovalCode,
      },
    })

    return NextResponse.json(newApprovalCode, { status: 201 })
  } catch (error) {
    console.error('Error creating approval code:', error)
    return NextResponse.json(
      { error: 'Failed to create approval code' },
      { status: 500 }
    )
  }
}
