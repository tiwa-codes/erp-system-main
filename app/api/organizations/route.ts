import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to view organizations
    const canView = await checkPermission(session.user.role as any, 'underwriting', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const state = searchParams.get('state')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } }
      ]
    }
    
    if (status && status !== 'all') {
      where.status = status
    }
    
    if (state && state !== 'all') {
      where.state = state
    }

    // Get organizations with pagination
    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          principal_accounts: {
            select: {
              id: true,
              status: true
            }
          },
          organization_plans: {
            include: {
              plan: {
                select: {
                  id: true,
                  name: true,
                  plan_type: true
                }
              }
            }
          }
        }
      }),
      prisma.organization.count({ where })
    ])

    // Format the response
    // @ts-ignore
    const formattedOrganizations = organizations.map(org => ({
      id: org.id,
      name: org.name,
      organization_code: org.code,
      type: org.type,
      status: org.status,
      contact_info: org.contact_info,
      premium_paid: org.premium_paid,
      created_at: org.created_at,
      updated_at: org.updated_at,
      principals_count: org.principal_accounts.length,
      // @ts-ignore
      active_principals_count: org.principal_accounts.filter(p => p.status === 'ACTIVE').length,
      dependents_count: 0, // Dependents are linked through principals
      active_dependents_count: 0, // Dependents are linked through principals
      organization_plans: org.organization_plans.map((op: any) => ({
        id: op.id,
        plan_id: op.plan_id,
        is_default: op.is_default,
        plan: op.plan
      }))
    }))

    return NextResponse.json({
      organizations: formattedOrganizations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching organizations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
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

    // Check permission to create organizations
    const canCreate = await checkPermission(session.user.role as any, 'underwriting', 'add')
    if (!canCreate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      organizationCode,
      contactPerson,
      contactNumber,
      email,
      accountType,
      state,
      lga,
      region,
      business_type,
      headOfficeAddress,
      startDate,
      endDate,
      autoRenewal,
      logoUrl,
      uploadedFiles,
      uploadedFileUrls,
      planIds,
      premiumPaid
    } = body

    // Validate required fields
    if (!name || !organizationCode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate organization code format (must be alphanumeric, minimum 2 characters)
    if (!/^[A-Z0-9]{2,}$/.test(organizationCode)) {
      return NextResponse.json({ 
        error: 'Organization code must be at least 2 alphanumeric characters (e.g., AB, TB123, COMPANY01)' 
      }, { status: 400 })
    }

    // Validate plan selection
    if (!planIds || planIds.length === 0) {
      return NextResponse.json({ error: 'At least one plan must be selected' }, { status: 400 })
    }

    // Check if organization code already exists
    const existingOrg = await prisma.organization.findFirst({
      where: { code: organizationCode }
    })

    if (existingOrg) {
      return NextResponse.json({ error: 'Organization initials already exists' }, { status: 400 })
    }

    // Prepare contact info
    const contactInfo = {
      contactPerson,
      contactNumber,
      email,
      state,
      lga,
      region,
      business_type,
      headOfficeAddress,
      startDate,
      endDate,
      autoRenewal,
      logoUrl: uploadedFileUrls && uploadedFileUrls.length > 0 ? uploadedFileUrls[0] : logoUrl,
      uploadedFiles: uploadedFiles || [],
      uploadedFileUrls: uploadedFileUrls || []
    }

    // Generate unique organization_id with retry logic
    let nextOrganizationId: string
    let attempts = 0
    const maxAttempts = 5
    
    do {
      const lastOrganization = await prisma.organization.findFirst({
        orderBy: { organization_id: 'desc' }
      })
      
      nextOrganizationId = lastOrganization 
        ? (parseInt(lastOrganization.organization_id) + 1).toString()
        : '1'
      
      // Check if this ID already exists
      const existingId = await prisma.organization.findFirst({
        where: { organization_id: nextOrganizationId }
      })
      
      if (!existingId) {
        break // ID is unique, we can use it
      }
      
      attempts++
      if (attempts >= maxAttempts) {
        // Fallback to UUID-based ID if numeric generation fails
        nextOrganizationId = `ORG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        console.log('Using fallback UUID-based organization ID:', nextOrganizationId)
        break
      }
      
      // Add a small delay and try again
      await new Promise(resolve => setTimeout(resolve, 100))
    } while (attempts < maxAttempts)

    // Create organization and organization plans in a transaction
    const premiumPaidValue = typeof premiumPaid === "number" ? premiumPaid : Number(premiumPaid)
    const normalizedPremiumPaid = Number.isFinite(premiumPaidValue) ? premiumPaidValue : null

    const result = await prisma.$transaction(async (tx) => {
      // Create the organization
      const organization = await tx.organization.create({
        data: {
          organization_id: nextOrganizationId,
          name,
          code: organizationCode,
          type: accountType as any || 'CORPORATE',
          state: state || null,
          lga: lga || null,
          region: region || null,
          business_type: business_type || null,
          contact_info: contactInfo,
          status: 'ACTIVE',
          premium_paid: normalizedPremiumPaid
        }
      })

      // Create organization plan relationships
      const organizationPlans = await Promise.all(
        planIds.map((planId: string, index: number) =>
          tx.organizationPlan.create({
            data: {
              organization_id: organization.id,
              plan_id: planId,
              is_default: index === 0 // First plan is default
            }
          })
        )
      )

      return { organization, organizationPlans }
    })

    // Log the organization creation
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'ORGANIZATION_CREATED',
        resource: 'organizations',
        resource_id: result.organization.id,
        new_values: {
          organization_name: result.organization.name,
          organization_code: result.organization.code,
          contact_person: contactPerson,
          assigned_plans: planIds
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        id: result.organization.id,
        name: result.organization.name,
        organization_code: result.organization.code,
        type: result.organization.type,
        contact_info: result.organization.contact_info,
        status: result.organization.status,
        created_at: result.organization.created_at
      },
      message: 'Organization created successfully'
    })
  } catch (error) {
    console.error('Error creating organization:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create organization',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
