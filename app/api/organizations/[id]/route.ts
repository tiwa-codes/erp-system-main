import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        principal_accounts: {
          include: {
            dependents: {
              select: {
                id: true,
                status: true
              }
            }
          }
        },
        organization_plans: {
          include: {
            plan: {
              select: {
                id: true,
                name: true,
                plan_type: true,
                premium_amount: true,
                annual_limit: true
              }
            }
          }
        }
      }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get timeline/audit logs for this organization
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        resource: 'organizations',
        resource_id: id
      },
      orderBy: { created_at: 'desc' },
      take: 20,
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    })

    const createdByLog =
      auditLogs.find((log) => log.action === 'ORGANIZATION_CREATED') ||
      [...auditLogs].sort((a, b) => a.created_at.getTime() - b.created_at.getTime())[0]

    const createdBy = createdByLog?.user
      ? {
          id: createdByLog.user.id,
          first_name: createdByLog.user.first_name,
          last_name: createdByLog.user.last_name,
          email: createdByLog.user.email,
        }
      : null

    return NextResponse.json({
      ...organization,
      audit_logs: auditLogs,
      created_by: createdBy,
      principals_count: organization.principal_accounts.length,
      active_principals_count: organization.principal_accounts.filter(p => p.status === 'ACTIVE').length,
      dependents_count: organization.principal_accounts.reduce((sum, p) => sum + p.dependents.length, 0)
    })
  } catch (error) {
    console.error('Error fetching organization:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
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

    // Check permission to edit organizations
    const canEdit = await checkPermission(session.user.role as any, 'underwriting', 'edit')
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params
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
      status,
      planIds,
      premiumPaid
    } = body

    // Validate required fields
    if (!name || !organizationCode || !contactPerson || !contactNumber || !email || !accountType || !state || !lga) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate plan selection
    if (!planIds || planIds.length === 0) {
      return NextResponse.json({ error: 'At least one plan must be selected' }, { status: 400 })
    }

    // Validate organization code format (must be alphanumeric, minimum 2 characters)
    if (!/^[A-Z0-9]{2,}$/.test(organizationCode)) {
      return NextResponse.json({ 
        error: 'Organization code must be at least 2 alphanumeric characters (e.g., AB, TB123, COMPANY01)' 
      }, { status: 400 })
    }

    // Check if organization exists
    const existingOrg = await prisma.organization.findUnique({
      where: { id }
    })

    if (!existingOrg) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Check if organization code is already taken by another organization
    console.log('Checking code uniqueness:', { organizationCode, currentId: id })
    
    const codeExists = await prisma.organization.findFirst({
      where: { 
        code: organizationCode,
        id: { not: id }
      }
    })

    console.log('Code exists check result:', codeExists)

    if (codeExists) {
      return NextResponse.json({ error: 'Organization code already exists' }, { status: 400 })
    }

    // Check if email is already taken by another organization
    // Note: Email is stored in contact_info JSON, so we'll skip this check for now
    // const emailExists = await prisma.organization.findFirst({
    //   where: { 
    //     email,
    //     NOT: { id }
    //   }
    // })

    // if (emailExists) {
    //   return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    // }

    // Update organization and organization plans in a transaction
    const premiumPaidValue = typeof premiumPaid === "number" ? premiumPaid : Number(premiumPaid)
    const normalizedPremiumPaid = Number.isFinite(premiumPaidValue) ? premiumPaidValue : null

    const result = await prisma.$transaction(async (tx) => {
      // Update the organization
      const organization = await tx.organization.update({
        where: { id },
        data: {
          name,
          code: organizationCode,
          type: accountType as any || 'CORPORATE',
          state: state || null,
          lga: lga || null,
          region: region || null,
          business_type: business_type || null,
          contact_info: {
            contact_person: contactPerson,
            phone_number: contactNumber,
            email: email,
            state: state,
            lga: lga,
            region: region,
            business_type: business_type,
            headOfficeAddress: headOfficeAddress || null,
            startDate: startDate || null,
            endDate: endDate || null,
            autoRenewal: !!autoRenewal,
          },
          status: (status as any) || 'ACTIVE',
          premium_paid: normalizedPremiumPaid
        }
      })

      // Delete existing organization-plan relationships
      await tx.organizationPlan.deleteMany({
        where: { organization_id: id }
      })

      // Create new organization-plan relationships
      const organizationPlans = await Promise.all(
        planIds.map((planId: string, index: number) =>
          tx.organizationPlan.create({
            data: {
              organization_id: id,
              plan_id: planId,
              is_default: index === 0 // First plan is default
            }
          })
        )
      )

      return { organization, organizationPlans }
    })

    // Log the organization update
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'ORGANIZATION_UPDATED',
        resource: 'organizations',
        resource_id: id,
        old_values: {
          name: existingOrg.name,
          organization_code: existingOrg.code,
          contact_person: existingOrg.contact_info?.contactPerson || 'N/A',
          email: existingOrg.contact_info?.email || 'N/A'
        },
        new_values: {
          name: result.organization.name,
          organization_code: result.organization.code,
          contact_person: contactPerson,
          email: email,
          assigned_plans: planIds
        }
      }
    })

    return NextResponse.json({
      id: result.organization.id,
      name: result.organization.name,
      organization_code: result.organization.code,
      type: result.organization.type,
      contact_info: result.organization.contact_info,
      status: result.organization.status,
      updated_at: result.organization.updated_at
    })
  } catch (error) {
    console.error('Error updating organization:', error)
    return NextResponse.json(
      { error: 'Failed to update organization' },
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

    // Check permission to delete organizations
    const canDelete = await checkPermission(session.user.role as any, 'underwriting', 'delete')
    if (!canDelete) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        principal_accounts: true
      }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Check if organization has principal accounts
    if (organization.principal_accounts.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete organization with existing principal accounts' 
      }, { status: 400 })
    }

    // Log the organization deletion
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'ORGANIZATION_DELETED',
        resource: 'organizations',
        resource_id: id,
        old_values: {
          deleted_organization: {
            name: organization.name,
            organization_code: organization.code,
            contact_person: organization.contact_info?.contactPerson || 'N/A'
          }
        }
      }
    })

    // Delete the organization
    await prisma.organization.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Organization deleted successfully' })
  } catch (error) {
    console.error('Error deleting organization:', error)
    return NextResponse.json(
      { error: 'Failed to delete organization' },
      { status: 500 }
    )
  }
}
