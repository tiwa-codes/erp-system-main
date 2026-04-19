import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import { AccountStatus, AccountType, Gender } from '@prisma/client'
import { getEnrolleeUtilization } from '@/lib/underwriting/usage'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Allow access if user has underwriting view OR telemedicine view permissions
    // Telemedicine users need to view principals for patient timeline and appointments
    const canViewUnderwriting = await checkPermission(session.user.role as any, 'underwriting', 'view')
    const canViewTelemedicine = await checkPermission(session.user.role as any, 'telemedicine', 'view')
    
    if (!canViewUnderwriting && !canViewTelemedicine) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    const principal = await prisma.principalAccount.findUnique({
      where: { id },
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
            plan_id: true,
            name: true,
            plan_type: true,
            premium_amount: true,
            annual_limit: true,
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
        dependents: {
          select: {
            id: true,
            dependent_id: true,
            first_name: true,
            last_name: true,
            date_of_birth: true,
            relationship: true,
            status: true,
            profile_picture: true,
          },
        },
        claims: {
          select: {
            id: true,
            claim_number: true,
            amount: true,
            status: true,
            submitted_at: true,
            provider: {
              select: {
                id: true,
                facility_name: true,
                hcp_code: true,
              },
            },
          },
          orderBy: {
            submitted_at: 'desc',
          },
          take: 10,
        },
        medical_history: true,
        _count: {
          select: {
            dependents: true,
            claims: true,
          },
        },
      },
    })

    if (!principal) {
      return NextResponse.json({ error: 'Principal not found' }, { status: 404 })
    }

    // Backward compatibility:
    // Resolve legacy organization_id/plan_id values (e.g. organization.organization_id / plan.plan_id)
    // to canonical relation IDs so edit forms can pre-populate correctly.
    let resolvedOrganization = principal.organization
    let resolvedOrganizationId = principal.organization_id
    if (!resolvedOrganization && principal.organization_id) {
      const legacyOrganization = await prisma.organization.findFirst({
        where: {
          OR: [
            { id: principal.organization_id },
            { organization_id: principal.organization_id },
            { code: { equals: principal.organization_id, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          code: true,
        },
      })

      if (legacyOrganization) {
        resolvedOrganization = legacyOrganization
        resolvedOrganizationId = legacyOrganization.id
      }
    }

    let resolvedPlan = principal.plan
    let resolvedPlanId = principal.plan_id
    if (!resolvedPlan && principal.plan_id) {
      const legacyPlan = await prisma.plan.findFirst({
        where: {
          OR: [
            { id: principal.plan_id },
            { plan_id: { equals: principal.plan_id, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          plan_id: true,
          name: true,
          plan_type: true,
          premium_amount: true,
          annual_limit: true,
        },
      })

      if (legacyPlan) {
        resolvedPlan = legacyPlan
        resolvedPlanId = legacyPlan.id
      }
    }

    // Calculate real balance dynamically
    const utilization = await getEnrolleeUtilization(id)

    return NextResponse.json({
      ...principal,
      organization_id: resolvedOrganizationId,
      plan_id: resolvedPlanId,
      organization: resolvedOrganization,
      plan: resolvedPlan,
      balance: utilization.balance,
      amount_utilized: utilization.amount_utilized
    })
  } catch (error) {
    console.error('Error fetching principal:', error)
    return NextResponse.json(
      { error: 'Failed to fetch principal' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canEdit = await checkPermission(session.user.role as any, 'underwriting', 'edit')
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const {
      enrollee_id,
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
      status,
      old_utilization,
    } = body

    const existingPrincipal = await prisma.principalAccount.findUnique({ where: { id } })
    if (!existingPrincipal) {
      return NextResponse.json({ error: 'Principal not found' }, { status: 404 })
    }

    const normalizedRole = (session.user.role || "").toString().toUpperCase()
    const canEditEnrolleeId = ["ADMIN", "SUPER_ADMIN"].includes(normalizedRole)

    let nextEnrolleeId = existingPrincipal.enrollee_id
    if (typeof enrollee_id === "string") {
      const trimmedEnrolleeId = enrollee_id.trim()
      if (!trimmedEnrolleeId) {
        return NextResponse.json({ error: "Enrollee ID is required" }, { status: 400 })
      }

      if (trimmedEnrolleeId !== existingPrincipal.enrollee_id) {
        if (!canEditEnrolleeId) {
          return NextResponse.json({ error: "Only admins can edit Enrollee ID" }, { status: 403 })
        }

        const [principalConflict, dependentConflict] = await Promise.all([
          prisma.principalAccount.findFirst({
            where: {
              id: { not: id },
              enrollee_id: {
                equals: trimmedEnrolleeId,
                mode: "insensitive",
              },
            },
            select: { id: true },
          }),
          prisma.dependent.findFirst({
            where: {
              dependent_id: {
                equals: trimmedEnrolleeId,
                mode: "insensitive",
              },
            },
            select: { id: true },
          }),
        ])

        if (principalConflict || dependentConflict) {
          return NextResponse.json(
            { error: `Enrollee ID "${trimmedEnrolleeId}" already exists` },
            { status: 409 }
          )
        }

        nextEnrolleeId = trimmedEnrolleeId
      }
    }

    const normalizedOrganizationId = typeof organization_id === "string" ? organization_id.trim() : ""
    if (!normalizedOrganizationId) {
      return NextResponse.json({ error: "Organization is required" }, { status: 400 })
    }

    const resolvedOrganization = await prisma.organization.findFirst({
      where: {
        OR: [
          { id: normalizedOrganizationId },
          { organization_id: normalizedOrganizationId },
          { code: { equals: normalizedOrganizationId, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    })
    if (!resolvedOrganization) {
      return NextResponse.json({ error: "Selected organization not found" }, { status: 400 })
    }

    let resolvedPlanId: string | null = null
    if (typeof plan_id === "string" && plan_id.trim()) {
      const normalizedPlanId = plan_id.trim()
      const resolvedPlan = await prisma.plan.findFirst({
        where: {
          OR: [
            { id: normalizedPlanId },
            { plan_id: { equals: normalizedPlanId, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      })
      if (!resolvedPlan) {
        return NextResponse.json({ error: "Selected plan not found" }, { status: 400 })
      }
      resolvedPlanId = resolvedPlan.id
    }

    const updatedPrincipal = await prisma.principalAccount.update({
      where: { id },
      data: {
        enrollee_id: nextEnrolleeId,
        first_name,
        last_name,
        middle_name,
        gender: gender && gender !== "" ? gender as Gender : null,
        date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
        age: age || null,
        profile_picture: profile_picture || null,
        marital_status: marital_status && marital_status !== "" ? marital_status as any : null,
        region: region || null,
        state: state || null,
        lga: lga || null,
        business_type: business_type || null,
        phone_number,
        email,
        residential_address,
        organization_id: resolvedOrganization.id,
        plan_id: resolvedPlanId,
        account_type: (account_type || existingPrincipal.account_type) as AccountType,
        auto_renewal: auto_renewal || false,
        primary_hospital,
        hospital_address,
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
        status: (status || existingPrincipal.status) as AccountStatus,
        old_utilization: old_utilization !== undefined && old_utilization !== null
          ? Number(old_utilization)
          : existingPrincipal.old_utilization,
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PRINCIPAL_UPDATE',
        resource: 'principal_account',
        resource_id: updatedPrincipal.id,
        old_values: existingPrincipal,
        new_values: updatedPrincipal,
      },
    })

    return NextResponse.json(updatedPrincipal)
  } catch (error) {
    console.error('Error updating principal:', error)
    return NextResponse.json(
      { error: 'Failed to update principal' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canDelete = await checkPermission(session.user.role as any, 'underwriting', 'delete')
    if (!canDelete) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    const existingPrincipal = await prisma.principalAccount.findUnique({ 
      where: { id },
      include: {
        dependents: true,
        medical_history: true,
      }
    })
    if (!existingPrincipal) {
      return NextResponse.json({ error: 'Principal not found' }, { status: 404 })
    }

    // Delete dependents first
    if (existingPrincipal.dependents.length > 0) {
      await prisma.dependent.deleteMany({
        where: { principal_id: id }
      })
    }

    // Delete medical history if it exists
    if (existingPrincipal.medical_history) {
      await prisma.medicalHistory.delete({
        where: { principal_account_id: id }
      })
    }

    // Finally delete the principal account
    await prisma.principalAccount.delete({
      where: { id },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PRINCIPAL_DELETE',
        resource: 'principal_account',
        resource_id: id,
        old_values: existingPrincipal,
      },
    })

    return NextResponse.json({ message: 'Principal deleted successfully' })
  } catch (error) {
    console.error('Error deleting principal:', error)
    return NextResponse.json(
      { error: 'Failed to delete principal' },
      { status: 500 }
    )
  }
}
