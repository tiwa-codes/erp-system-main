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

    const canViewProviders = await checkPermission(session.user.role as any, 'provider', 'view')
    const canManageTariffPlan = await checkPermission(session.user.role as any, 'provider', 'manage_tariff_plan')
    const canGenerateApprovalCode = await checkPermission(session.user.role as any, 'call-centre', 'generate-code')
    const canHandleProviderRequests = await checkPermission(session.user.role as any, 'call-centre', 'requests')
    const canViewClaims = await checkPermission(session.user.role as any, 'claims', 'view')
    const canViewTelemedicine = await checkPermission(session.user.role as any, 'telemedicine', 'view')
    
    // Allow access if the user can manage providers directly or needs provider selection
    // inside the call-centre approval-code/request flows.
    if (
      !canViewProviders &&
      !canManageTariffPlan &&
      !canGenerateApprovalCode &&
      !canHandleProviderRequests &&
      !canViewClaims &&
      !canViewTelemedicine
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get user's provider information for filtering
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { provider: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const trimmedSearch = search.trim()
    const facility_type = searchParams.get('facility_type') || ''
    const status = searchParams.get('status') || ''

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    // If user is PROVIDER role with provider_id, only show their own provider
    // If PROVIDER role without provider_id, show all providers (for selection)
    // PROVIDER_MANAGER and other roles can see all providers
    if (session.user.role === 'PROVIDER' && user.provider_id && !canViewProviders) {
      where.id = user.provider_id
    }
    // PROVIDER role without provider_id can see all providers for selection
    
    if (trimmedSearch) {
      where.facility_name = {
        startsWith: trimmedSearch,
        mode: 'insensitive'
      }
    }

    if (facility_type && facility_type !== 'all') {
      where.facility_type = {
        array_contains: [facility_type]
      }
    }

    if (status && status !== 'all') {
      where.status = status
    }

    const [providers, total] = await Promise.all([
      prisma.provider.findMany({
        where,
        include: {
          _count: {
            select: {
              claims: true,
              in_patients: true,
              plan_bands: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.provider.count({ where })
    ])

    return NextResponse.json({
      providers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching providers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch providers' },
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

    const canAddProviders = await checkPermission(session.user.role as any, 'provider', 'add')
    if (!canAddProviders) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      // Section 1: Basic Information
      partnership_interest,
      facility_name,
      address,
      phone_whatsapp,
      email,
      medical_director_name,
      hmo_coordinator_name,
      hmo_coordinator_phone,
      hmo_coordinator_email,
      year_of_incorporation,
      facility_reg_number,
      practice,
      proprietor_partners,
      hcp_code,
      
      // Section 2: Service Delivery
      hours_of_operation,
      other_branches,
      emergency_care_services,
      facility_type,
      personnel_licensed,
      blood_bank_available,
      blood_sourcing_method,
      radiology_lab_services,
      other_services,
      
      // Section 3: Banking Information
      account_name,
      account_number,
      designation,
      date,
      
      // Documents
      documents,
      
      // Band selection
      selected_bands
    } = body

    // All fields are optional — no required-field validation

    // Check if facility already exists (only when facility_name is provided)
    if (facility_name) {
      const existingProvider = await prisma.provider.findFirst({
        where: { facility_name }
      })

      if (existingProvider) {
        return NextResponse.json({ error: 'Facility with this name already exists' }, { status: 400 })
      }
    }

    // Generate unique provider_id with retry logic
    let nextProviderId: string
    let attempts = 0
    const maxAttempts = 5
    
    do {
      const lastProvider = await prisma.provider.findFirst({
        orderBy: { provider_id: 'desc' }
      })
      
      nextProviderId = lastProvider 
        ? (parseInt(lastProvider.provider_id) + 1).toString()
        : '1'
      
      // Check if this ID already exists
      const existingId = await prisma.provider.findFirst({
        where: { provider_id: nextProviderId }
      })
      
      if (!existingId) {
        break // ID is unique, we can use it
      }
      
      attempts++
      if (attempts >= maxAttempts) {
        // Fallback to UUID-based ID if numeric generation fails
        nextProviderId = `PROV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        console.log('Using fallback UUID-based provider ID:', nextProviderId)
        break
      }
      
      // Add a small delay and try again
      await new Promise(resolve => setTimeout(resolve, 100))
    } while (attempts < maxAttempts)

    const provider = await prisma.provider.create({
      data: {
        provider_id: nextProviderId,
        // Section 1: Basic Information
        partnership_interest,
        facility_name: facility_name || "",
        address: address || "",
        phone_whatsapp: phone_whatsapp || "",
        email: email || "",
        medical_director_name: medical_director_name || "",
        hmo_coordinator_name: hmo_coordinator_name || "",
        hmo_coordinator_phone: hmo_coordinator_phone || "",
        hmo_coordinator_email: hmo_coordinator_email || "",
        year_of_incorporation: year_of_incorporation || "",
        facility_reg_number: facility_reg_number || "",
        practice: practice || "",
        proprietor_partners: proprietor_partners || "",
        hcp_code,
        
        // Section 2: Service Delivery
        hours_of_operation,
        other_branches,
        emergency_care_services,
        facility_type,
        personnel_licensed,
        blood_bank_available,
        blood_sourcing_method,
        radiology_lab_services,
        other_services,
        
        // Section 3: Banking Information
        account_name,
        account_number,
        designation,
        date: date ? new Date(date) : null,
        
        // Document URLs
        cac_registration_url: documents?.cac_registration || null,
        nhis_accreditation_url: documents?.nhis_accreditation || null,
        professional_indemnity_url: documents?.professional_indemnity || null,
        state_facility_registration_url: documents?.state_facility_registration || null,
        
        // Band selection
        selected_bands: selected_bands || [],
        
        status: 'PENDING_APPROVAL'
      }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PROVIDER_CREATE',
        resource: 'provider',
        resource_id: provider.id,
        new_values: body,
      },
    })

    return NextResponse.json(provider, { status: 201 })
  } catch (error) {
    console.error('Error creating provider:', error)
    return NextResponse.json(
      { error: 'Failed to create provider' },
      { status: 500 }
    )
  }
}
