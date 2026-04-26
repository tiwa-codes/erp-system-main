import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import { validateCoverageRule } from "@/lib/underwriting/coverage"
import { AccountStatus, AccountType, Gender, MaritalStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Allow access if user has underwriting view OR telemedicine view permissions
    // Telemedicine users may need to search principals for appointments
    const canViewUnderwriting = await checkPermission(session.user.role as any, 'underwriting', 'view')
    const canViewTelemedicine = await checkPermission(session.user.role as any, 'telemedicine', 'view')

    if (!canViewUnderwriting && !canViewTelemedicine) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const trimmedSearch = search?.trim()
    const organizationId = searchParams.get('organizationId')
    const planId = searchParams.get('planId')
    const status = searchParams.get('status')
    const rawPage = parseInt(searchParams.get('page') || '1')
    const rawLimit = parseInt(searchParams.get('limit') || '10')
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 10

    const where: any = {}

    if (trimmedSearch) {
      // Search mode rules:
      // - Letters/mixed     → name/email fields (startsWith)
      // - Digits ≤ 6        → enrollee_id contains only (NOT phone)
      // - Digits ≥ 7 or starts with '0' → phone_number contains
      const isDigitOnly = /^\d+$/.test(trimmedSearch)
      const isPhoneSearch = isDigitOnly && (trimmedSearch.length >= 7 || trimmedSearch.startsWith('0'))
      const isIdSearch = isDigitOnly && !isPhoneSearch

      if (isIdSearch) {
        const idSegmentSuffix = `/${trimmedSearch}`
        where.OR = [
          { enrollee_id: { endsWith: idSegmentSuffix, mode: 'insensitive' } },
        ]
      } else if (isPhoneSearch) {
        where.OR = [
          { phone_number: { contains: trimmedSearch, mode: 'insensitive' } },
          { enrollee_id: { contains: trimmedSearch, mode: 'insensitive' } },
        ]
      } else {
        where.OR = [
          { first_name: { startsWith: trimmedSearch, mode: 'insensitive' } },
          { last_name: { startsWith: trimmedSearch, mode: 'insensitive' } },
          { email: { startsWith: trimmedSearch, mode: 'insensitive' } },
        ]
        // Full name search (e.g. "John Doe")
        const nameParts = trimmedSearch.split(' ').filter(p => p.trim())
        if (nameParts.length >= 2) {
          where.OR.push({
            AND: [
              { first_name: { startsWith: nameParts[0], mode: 'insensitive' } },
              { last_name: { startsWith: nameParts[nameParts.length - 1], mode: 'insensitive' } }
            ]
          })
        }
      }
    }

    if (organizationId && organizationId !== 'all') {
      where.organization_id = organizationId
    }

    if (planId && planId !== 'all') {
      const selectedPlan = await prisma.plan.findFirst({
        where: {
          OR: [
            { id: planId },
            { plan_id: planId },
          ],
        },
        select: {
          id: true,
          plan_id: true,
        },
      })

      const candidatePlanIds = Array.from(
        new Set(
          [
            planId,
            selectedPlan?.id,
            selectedPlan?.plan_id,
          ].filter((value): value is string => Boolean(value))
        )
      )

      // Handle both modern records (plan_id = Plan.id) and older records (plan_id = Plan.plan_id).
      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { plan_id: { in: candidatePlanIds } },
        ]
        delete where.OR
      } else {
        where.plan_id = { in: candidatePlanIds }
      }
    }

    if (status && status !== 'all') {
      where.status = status as AccountStatus
    }

    const [principals, dependents, totalPrincipals] = await Promise.all([
      prisma.principalAccount.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          plan: {
            select: {
              id: true,
              name: true,
            },
          },
          created_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          _count: {
            select: {
              dependents: true,
              claims: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      // Search dependents using same smart logic as principals
      prisma.dependent.findMany({
        where: (() => {
          const isDigitOnly = /^\d+$/.test(trimmedSearch || '')
          const isPhoneSearch = isDigitOnly && ((trimmedSearch?.length ?? 0) >= 7 || trimmedSearch?.startsWith('0'))
          const isIdSearch = isDigitOnly && !isPhoneSearch
          let depWhere: any = { status: 'ACTIVE' }
          if (trimmedSearch) {
            if (isIdSearch) {
              const idSegmentSuffix = `/${trimmedSearch}`
              const idSegmentMiddle = `/${trimmedSearch}/`
              depWhere.OR = [
                { dependent_id: { contains: idSegmentMiddle, mode: 'insensitive' } },
                { dependent_id: { endsWith: idSegmentSuffix, mode: 'insensitive' } },
              ]
            } else if (isPhoneSearch) {
              depWhere.OR = [
                { phone_number: { contains: trimmedSearch, mode: 'insensitive' } },
                { dependent_id: { contains: trimmedSearch, mode: 'insensitive' } },
              ]
            } else {
              depWhere.OR = [
                { first_name: { startsWith: trimmedSearch, mode: 'insensitive' } },
                { last_name: { startsWith: trimmedSearch, mode: 'insensitive' } },
              ]
            }
          }
          return depWhere
        })(),
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          principal: {
            include: {
              organization: true,
              plan: true
            }
          }
        }
      }),

      prisma.principalAccount.count({ where }),
    ])

    return NextResponse.json({
      principals,
      dependents,
      pagination: {
        total: totalPrincipals, // Note: Pagination logic is primarily for principals list view, search results might be mixed
        page,
        limit,
        pages: Math.ceil(totalPrincipals / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching principals:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Failed to fetch principals',
        ...(process.env.NODE_ENV !== 'production' ? { detail: message } : {}),
      },
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

    const canAdd = await checkPermission(session.user.role as any, 'underwriting', 'add')
    if (!canAdd) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    const {
      first_name,
      last_name,
      middle_name,
      gender,
      date_of_birth,
      age,
      profile_picture,
      marital_status,
      region,
      state,
      lga,
      business_type,
      phone_number,
      email,
      residential_address,
      organization_id,
      plan_id,
      account_type,
      auto_renewal,
      primary_hospital,
      hospital_address,
      start_date,
      end_date,
      // Medical History
      sickle_cell_disease,
      kidney_disease,
      epilepsy,
      cancer_prostate_cervical,
      asthma,
      hiv_aids,
      surgeries,
      diabetes_mellitus,
      cataract,
      goiter,
      peptic_ulcer,
      hypertension,
      glaucoma,
      tuberculosis,
      haemorrhoids,
      hepatitis,
      disease_comments,
      // Dependents
      dependents,
    } = body

    if (!first_name || !last_name || !organization_id || !state) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!plan_id) {
      return NextResponse.json({ error: 'Plan selection is required' }, { status: 400 })
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await prisma.principalAccount.findFirst({
        where: { email }
      })

      if (existingEmail) {
        return NextResponse.json({
          error: 'Email already exists',
          message: 'An enrollee with this email already exists'
        }, { status: 400 })
      }
    }


    // Generate enrollee_id in format: CJH/ORG/001
    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: organization_id },
      select: { name: true, code: true }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get the next serial number GLOBALLY (across all organizations)
    // This ensures sequential numbering: CJH/CC/3913, CJH/TB/3914, CJH/CC/3915, etc.
    // Use organization code (should be 2 letters)
    const orgCode = organization.code.toUpperCase()

    // Use centralized ID generator
    const { getNextGlobalEnrolleeId } = await import("@/lib/utils/id-generator")
    const enrolleeId = await getNextGlobalEnrolleeId(orgCode)

    const dependentInputs = Array.isArray(dependents)
      ? dependents.map((dependent: any) => ({
        relationship: dependent.relationship,
        dateOfBirth: dependent.date_of_birth,
      }))
      : []

    const coverageResult = await validateCoverageRule({
      planId: plan_id,
      principalDateOfBirth: date_of_birth,
      dependents: dependentInputs,
    })

    if (!coverageResult.valid) {
      return NextResponse.json({ error: coverageResult.reason }, { status: 400 })
    }

    const newPrincipal = await prisma.principalAccount.create({
      data: {
        enrollee_id: enrolleeId,
        first_name,
        last_name,
        middle_name,
        gender: gender && gender !== "" ? gender as Gender : null,
        date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
        age: age || null,
        profile_picture: profile_picture || null,
        marital_status: marital_status && marital_status !== "" ? marital_status as MaritalStatus : null,
        region: region || null,
        state: state || null,
        lga: lga || null,
        business_type: business_type || null,
        phone_number,
        email,
        residential_address,
        organization_id,
        plan_id: plan_id || null,
        account_type: (account_type as AccountType) || AccountType.PRINCIPAL,
        auto_renewal: auto_renewal || false,
        primary_hospital,
        hospital_address,
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
        created_by_id: session.user.id,
        // Create medical history if any medical conditions are provided
        medical_history: (sickle_cell_disease || kidney_disease || epilepsy || cancer_prostate_cervical ||
          asthma || hiv_aids || surgeries || diabetes_mellitus || cataract || goiter ||
          peptic_ulcer || hypertension || glaucoma || tuberculosis || haemorrhoids ||
          hepatitis || disease_comments) ? {
          create: {
            sickle_cell_disease: sickle_cell_disease || false,
            kidney_disease: kidney_disease || false,
            epilepsy: epilepsy || false,
            cancer_prostate_cervical: cancer_prostate_cervical || false,
            asthma: asthma || false,
            hiv_aids: hiv_aids || false,
            surgeries: surgeries || false,
            diabetes_mellitus: diabetes_mellitus || false,
            cataract: cataract || false,
            goiter: goiter || false,
            peptic_ulcer: peptic_ulcer || false,
            hypertension: hypertension || false,
            glaucoma: glaucoma || false,
            tuberculosis: tuberculosis || false,
            haemorrhoids: haemorrhoids || false,
            hepatitis: hepatitis || false,
            disease_comments: disease_comments || null,
          }
        } : undefined,
        // Create dependents if any are provided
        dependents: dependents && dependents.length > 0 ? {
          create: dependents.map((dependent: any) => ({
            dependent_id: `DEP${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
            first_name: dependent.first_name,
            last_name: dependent.last_name,
            middle_name: dependent.middle_name || null,
            date_of_birth: new Date(dependent.date_of_birth),
            relationship: dependent.relationship,
            gender: dependent.gender && dependent.gender !== "" ? dependent.gender as Gender : null,
            phone_number: dependent.phone_number || null,
            email: dependent.email || null,
            residential_address: dependent.residential_address || null,
            profile_picture: dependent.profile_picture || null,
            preferred_provider_id: dependent.preferred_provider_id || null,
            status: 'ACTIVE' as any,
            created_by_id: session.user.id,
          }))
        } : undefined,
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PRINCIPAL_CREATE',
        resource: 'principal_account',
        resource_id: newPrincipal.id,
        new_values: newPrincipal,
      },
    })

    return NextResponse.json(newPrincipal, { status: 201 })
  } catch (error) {
    console.error('Error creating principal:', error)
    return NextResponse.json(
      { error: 'Failed to create principal' },
      { status: 500 }
    )
  }
}
