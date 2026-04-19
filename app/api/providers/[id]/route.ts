import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canViewProviders = await checkPermission(session.user.role as any, 'provider', 'view')
    if (!canViewProviders) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const provider = await prisma.provider.findUnique({
      where: { id: params.id },
      include: {
        claims: {
          take: 10,
          orderBy: { submitted_at: 'desc' },
          include: {
            principal: {
              select: {
                id: true,
                enrollee_id: true,
                first_name: true,
                last_name: true
              }
            }
          }
        },
        in_patients: {
          take: 10,
          orderBy: { admission_date: 'desc' }
        },
        risk_profiles: {
          take: 10,
          orderBy: { assessment_date: 'desc' }
        },
        _count: {
          select: {
            claims: true,
            in_patients: true,
            plan_bands: true
          }
        }
      }
    })

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    const latestAttachmentUpdate = await prisma.providerUpdate.findFirst({
      where: {
        provider_id: provider.id,
        source: 'PUBLIC_REGISTRATION_ATTACHMENTS',
      },
      orderBy: { created_at: 'desc' },
      select: { payload: true },
    })

    let others_attachment_url: string | null = null
    if (latestAttachmentUpdate?.payload && typeof latestAttachmentUpdate.payload === 'object') {
      const payload = latestAttachmentUpdate.payload as any
      const others = payload?.documents?.others
      if (typeof others === 'string' && others.trim().length > 0) {
        others_attachment_url = others
      }
    }

    return NextResponse.json({
      provider: {
        ...provider,
        others_attachment_url,
      },
    })
  } catch (error) {
    console.error('Error fetching provider:', error)
    return NextResponse.json(
      { error: 'Failed to fetch provider' },
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

    const canEditProviders = await checkPermission(session.user.role as any, 'provider', 'edit')
    if (!canEditProviders) {
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

    if (facility_name) {
      const existingProvider = await prisma.provider.findFirst({
        where: {
          facility_name,
          id: { not: params.id }
        }
      })

      if (existingProvider) {
        return NextResponse.json({ error: 'Facility with this name already exists' }, { status: 400 })
      }
    }

    const provider = await prisma.provider.update({
      where: { id: params.id },
      data: {
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
        date: date ? new Date(date) : null,
        
        // Document URLs
        cac_registration_url: documents?.cac_registration || null,
        nhis_accreditation_url: documents?.nhis_accreditation || null,
        professional_indemnity_url: documents?.professional_indemnity || null,
        state_facility_registration_url: documents?.state_facility_registration || null,
        
        // Band selection
        selected_bands: selected_bands || []
      }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PROVIDER_UPDATE',
        resource: 'provider',
        resource_id: provider.id,
        new_values: body,
      },
    })

    return NextResponse.json({ provider })
  } catch (error) {
    console.error('Error updating provider:', error)
    return NextResponse.json(
      { error: 'Failed to update provider' },
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

    const canDeleteProviders = await checkPermission(session.user.role as any, 'provider', 'delete')
    if (!canDeleteProviders) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if provider exists
    const provider = await prisma.provider.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            claims: true,
            in_patients: true,
            users: true,
            plan_bands: true,
            plan_providers: true,
            provider_requests: true,
            tariff_plans: true,
            tariff_plan_services: true,
            covered_services: true,
            approval_codes: true,
            updates: true,
            msas: true,
            risk_profiles: true,
            risk_profiles_new: true,
            telemedicine_appointments: true,
            approval_code_timeline: true,
            preferred_dependents: true
          }
        },
        tariff_file: {
          select: { id: true }
        }
      }
    })

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    // Only true operational data should block deletion.
    const blockingCounts = {
      claims: provider._count.claims,
      in_patients: provider._count.in_patients,
      provider_requests: provider._count.provider_requests,
      msas: provider._count.msas,
    }

    const blockingRelations = Object.entries(blockingCounts)
      .filter(([, count]) => count > 0)
      .map(([key]) => key.replace(/_/g, " "))

    if (blockingRelations.length > 0) {
      return NextResponse.json({
        error: `Cannot delete provider with related records: ${blockingRelations.join(", ")}. Please archive instead.`
      }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      // Detach soft-linked records first.
      await tx.user.updateMany({
        where: { provider_id: params.id },
        data: {
          provider_id: null,
          status: "INACTIVE",
        }
      })

      await tx.dependent.updateMany({
        where: { preferred_provider_id: params.id },
        data: { preferred_provider_id: null }
      })

      await tx.approvalCodeTimeline.updateMany({
        where: { provider_id: params.id },
        data: { provider_id: null }
      })

      await tx.approvalCode.updateMany({
        where: { provider_id: params.id },
        data: { provider_id: null }
      })

      await tx.telemedicineAppointment.updateMany({
        where: { provider_id: params.id },
        data: { provider_id: null }
      })

      // Remove provider-owned setup/config records.
      await tx.coveredService.deleteMany({ where: { facility_id: params.id } })
      await tx.planBand.deleteMany({ where: { provider_id: params.id } })
      await tx.planProvider.deleteMany({ where: { provider_id: params.id } })
      await tx.providerUpdate.deleteMany({ where: { provider_id: params.id } })
      await tx.providerRiskProfile.deleteMany({ where: { provider_id: params.id } })
      await tx.riskProfile.deleteMany({ where: { provider_id: params.id } })
      await tx.tariffPlanService.deleteMany({ where: { provider_id: params.id } })
      await tx.tariffPlan.deleteMany({ where: { provider_id: params.id } })
      await tx.providerTariffFile.deleteMany({ where: { provider_id: params.id } })

      // Delete the provider after cleanup.
      await tx.provider.delete({
        where: { id: params.id }
      })
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PROVIDER_DELETE',
        resource: 'provider',
        resource_id: params.id,
        old_values: {
          facility_name: provider.facility_name,
          email: provider.email,
          band: provider.band
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Provider deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting provider:', error)
    return NextResponse.json(
      { error: 'Failed to delete provider' },
      { status: 500 }
    )
  }
}
