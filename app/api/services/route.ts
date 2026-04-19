import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

// Predefined medical services with their codes and amounts
const medicalServices = [
  { id: "CONSULTATION", name: "General Consultation", code: "CON001", amount: 5000 },
  { id: "LAB_TEST", name: "Laboratory Test", code: "LAB001", amount: 3000 },
  { id: "XRAY", name: "X-Ray Examination", code: "XRY001", amount: 8000 },
  { id: "ULTRASOUND", name: "Ultrasound Scan", code: "ULT001", amount: 12000 },
  { id: "CT_SCAN", name: "CT Scan", code: "CTS001", amount: 25000 },
  { id: "MRI", name: "MRI Scan", code: "MRI001", amount: 45000 },
  { id: "SURGERY_MINOR", name: "Minor Surgery", code: "SUR001", amount: 50000 },
  { id: "SURGERY_MAJOR", name: "Major Surgery", code: "SUR002", amount: 150000 },
  { id: "EMERGENCY", name: "Emergency Treatment", code: "EMR001", amount: 15000 },
  { id: "PHYSIOTHERAPY", name: "Physiotherapy Session", code: "PHY001", amount: 8000 },
  { id: "DENTAL_CHECKUP", name: "Dental Checkup", code: "DEN001", amount: 10000 },
  { id: "EYE_EXAM", name: "Eye Examination", code: "EYE001", amount: 7000 },
  { id: "CARDIOLOGY", name: "Cardiology Consultation", code: "CAR001", amount: 12000 },
  { id: "DERMATOLOGY", name: "Dermatology Consultation", code: "DER001", amount: 8000 },
  { id: "GYNECOLOGY", name: "Gynecology Consultation", code: "GYN001", amount: 10000 },
  { id: "PEDIATRICS", name: "Pediatrics Consultation", code: "PED001", amount: 6000 },
  { id: "ORTHOPEDICS", name: "Orthopedics Consultation", code: "ORT001", amount: 12000 },
  { id: "NEUROLOGY", name: "Neurology Consultation", code: "NEU001", amount: 15000 },
  { id: "ONCOLOGY", name: "Oncology Consultation", code: "ONC001", amount: 20000 },
  { id: "PSYCHIATRY", name: "Psychiatry Consultation", code: "PSY001", amount: 10000 }
]

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const canView = await checkPermission(session.user.role as any, 'claims', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(request.url)
    const search = url.searchParams.get('search') || ''
    const providerId = url.searchParams.get('provider_id') || ''
    const limit = parseInt(url.searchParams.get('limit') || '100')

    // Build search conditions
    const searchConditions = search ? [
    { service_name: { contains: search, mode: 'insensitive' as const } },
      { service_category: { contains: search, mode: 'insensitive' as const } }
    ] : []

    let services = []

    if (providerId) {
      const findPlan = async (status?: string[]) => {
        const whereClause: any = {
          provider_id: providerId,
        }

        if (status) {
          whereClause.status = { in: status }
        }

        return prisma.tariffPlan.findFirst({
          where: whereClause,
          orderBy: [
            { approved_at: "desc" },
            { created_at: "desc" }
          ],
        })
      }

      // Show services from APPROVED or COMPLETE tariff plans
      // COMPLETE status indicates the tariff plan has been fully approved and finalized
      const approvedPlan = await findPlan(["APPROVED", "COMPLETE"])

      if (!approvedPlan) {
        // Debug: Check what tariff plans exist for this provider
        const allPlans = await prisma.tariffPlan.findMany({
          where: { provider_id: providerId },
          select: {
            id: true,
            status: true,
            version: true,
            approved_at: true,
            created_at: true,
            approval_stage: true
          },
          orderBy: { created_at: 'desc' },
          take: 5
        })

        console.log(`No approved tariff plan found for provider ${providerId}. Existing plans:`, allPlans)

        // Check if there's a DRAFT or PENDING_APPROVAL plan
        const draftPlan = allPlans.find(p => p.status === 'DRAFT')
        const pendingPlan = allPlans.find(p => p.status === 'PENDING_APPROVAL')

        let message = "No approved tariff plan found for this provider."
        if (draftPlan) {
          message = `Tariff plan exists but is in DRAFT status. Please submit the tariff plan for approval in Provider Management. Plan ID: ${draftPlan.id}`
        } else if (pendingPlan) {
          message = `Tariff plan is pending approval. Please wait for Provider Management to approve it. Plan ID: ${pendingPlan.id}, Stage: ${pendingPlan.approval_stage}`
        } else {
          message = "No tariff plan found for this provider. Please create and approve a tariff plan in Provider Management."
        }

        return NextResponse.json({
          success: true,
          services: [],
          total: 0,
          message: message,
          debug: {
            provider_id: providerId,
            existing_plans: allPlans.map(p => ({
              id: p.id,
              status: p.status,
              version: p.version,
              approval_stage: p.approval_stage,
              approved_at: p.approved_at
            }))
          }
        })
      }

      const tariffPlanServices = await prisma.tariffPlanService.findMany({
        where: {
          provider_id: providerId,
          tariff_plan_id: approvedPlan.id,
          status: 'ACTIVE',
          ...(searchConditions.length > 0 ? {
            OR: [
              { service_name: { contains: search, mode: 'insensitive' as const } },
              { service_id: { contains: search, mode: 'insensitive' as const } }
            ]
          } : {})
        },
        take: limit,
        orderBy: { service_name: 'asc' }
      })

      // Debug: Log if no services found but tariff plan exists
      if (tariffPlanServices.length === 0 && search) {
        const allServicesForPlan = await prisma.tariffPlanService.findMany({
          where: {
            provider_id: providerId,
            tariff_plan_id: approvedPlan.id,
            status: 'ACTIVE'
          },
          select: {
            service_name: true,
            service_id: true
          },
          take: 10
        })
        console.log(`No services found matching "${search}" for tariff plan ${approvedPlan.id}. Available services:`, allServicesForPlan.map(s => s.service_name))
      }

      // Fetch service type to get category if not in tariff plan service
      const serviceTypeIds = tariffPlanServices.map(s => s.service_id)
      const serviceTypes = await prisma.serviceType.findMany({
        where: {
          service_id: { in: serviceTypeIds }
        },
        select: {
          service_id: true,
          service_category: true
        }
      })
      
      const serviceTypeMap = new Map(serviceTypes.map(st => [st.service_id, st.service_category]))
      
      const mappedServices = tariffPlanServices.map(service => ({
        id: service.id,
        name: service.service_name,
        code: service.service_id,
        amount: service.price,
        service_category: service.category_name || serviceTypeMap.get(service.service_id) || '',
        facility_price: service.price,
        service_status: service.status,
        plans: [],
      }))

      const responseMessage = approvedPlan
        ? "Approved tariff plan services"
        : "Only approved services are available"

      return NextResponse.json({
        success: true,
        services: mappedServices,
        total: mappedServices.length,
        planStatus: approvedPlan?.status || 'APPROVED',
        message: responseMessage
      })
    }

    // Original logic for when providerId is not specified
    // Fetch services covered by this specific provider
    const coveredServices = await prisma.coveredService.findMany({
      where: {
        ...(searchConditions.length > 0 ? { OR: searchConditions.map(condition => ({ service_type: condition })) } : {}),
        status: 'ACTIVE'
      },
      select: {
        service_type: {
          select: {
            id: true,
            service_name: true,
            service_category: true
          }
        },
        facility_price: true,
        plan: {
          select: {
            id: true,
            name: true,
            plan_type: true
          }
        }
      },
      take: limit,
      orderBy: { service_type: { service_name: 'asc' } }
    })

    services = coveredServices.map(item => ({
      id: item.service_type.id,
      service_name: item.service_type.service_name,
      service_category: item.service_type.service_category,
      facility_price: item.facility_price,
      plans: [{ id: item.plan.id, name: item.plan.name, plan_type: item.plan.plan_type }]
    }))

    // Fallback: if no covered services, fetch all services from database
    if (services.length === 0) {
      const fallbackServices = await prisma.serviceType.findMany({
        where: searchConditions.length > 0 ? { OR: searchConditions } : {},
        select: {
          id: true,
          service_name: true,
          service_category: true
        },
        take: limit,
        orderBy: { service_name: 'asc' }
      })
      
      services = fallbackServices.map(service => ({
        id: service.id,
        service_name: service.service_name,
        service_category: service.service_category,
        facility_price: 5000, // Default price
        plans: []
      }))
    }

    // Map to frontend expected format
    const mappedServices = services.map(service => ({
      id: service.id,
      name: service.service_name,
      code: service.service_category,
      amount: service.facility_price || 5000, // Use facility-specific price if available
      service_category: service.service_category || '', // Include service category
      plans: service.plans || [], // Include plan information for coverage checking
      facility_price: service.facility_price || 5000
    }))

    // Fallback to hardcoded services if database is empty
    let finalServices = mappedServices
    if (mappedServices.length === 0) {
      finalServices = medicalServices.slice(0, limit)
    }

    return NextResponse.json({
      success: true,
      services: finalServices,
      total: finalServices.length
    })

  } catch (error) {
    console.error('Error fetching services:', error)
    
    // Fallback to hardcoded services on error
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '100')
    
    return NextResponse.json({
      success: true,
      services: medicalServices.slice(0, limit),
      total: medicalServices.length
    })
  }
}
