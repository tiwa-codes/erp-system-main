import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, 'telemedicine', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: facilityId } = params

    // Verify facility exists
    const facility = await prisma.telemedicineFacility.findUnique({
      where: { id: facilityId },
      select: {
        id: true,
        facility_name: true,
        facility_type: true,
        status: true
      }
    })

    if (!facility) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
    }

    // Determine service category based on facility type
    let serviceCategory: string
    switch (facility.facility_type) {
      case 'LAB':
        serviceCategory = 'Laboratory Services'
        break
      case 'RADIOLOGY':
        serviceCategory = 'Radiology / Imaging'
        break
      case 'PHARMACY':
        serviceCategory = 'Drugs / Pharmaceuticals'
        break
      default:
        serviceCategory = 'General Services'
    }

    // Fetch ONLY services that have tariffs for THIS specific facility
    // Query FacilityTariff first, filtered by facility_id, then get ServiceType details
    const facilityTariffs = await prisma.facilityTariff.findMany({
      where: {
        facility_id: facilityId,
        service: {
          service_category: serviceCategory
        }
      },
      include: {
        service: {
          select: {
            id: true,
            service_name: true,
            service_category: true,
            created_at: true
          }
        }
      },
      orderBy: {
        service: {
          service_name: 'asc'
        }
      }
    })

    // Map tariffs with their service information - only services with tariffs for this facility
    const servicesWithPricing = facilityTariffs.map(tariff => ({
      id: tariff.service.id,
      service_name: tariff.service.service_name,
      service_category: tariff.service.service_category,
      current_price: tariff.price,
      tariff_id: tariff.id,
      facility_id: facilityId,
      facility_name: facility.facility_name,
      facility_type: facility.facility_type,
      created_at: tariff.service.created_at,
      tariff_created_at: tariff.created_at,
      tariff_updated_at: tariff.updated_at
    }))

    return NextResponse.json({
      success: true,
      facility,
      serviceCategory,
      services: servicesWithPricing,
      totalServices: servicesWithPricing.length
    })

  } catch (error) {
    console.error('Error fetching facility tariff plan:', error)
    return NextResponse.json(
      { error: 'Failed to fetch facility tariff plan' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canEdit = await checkPermission(session.user.role as any, 'telemedicine', 'edit')
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: facilityId } = params
    const body = await request.json()
    const { serviceId, price } = body

    if (!serviceId || !price) {
      return NextResponse.json({ 
        error: 'Service ID and price are required' 
      }, { status: 400 })
    }

    // Verify facility exists
    const facility = await prisma.telemedicineFacility.findUnique({
      where: { id: facilityId }
    })

    if (!facility) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
    }

    // Verify service exists
    const service = await prisma.serviceType.findUnique({
      where: { id: serviceId }
    })

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    // Create or update the facility tariff
    const tariff = await prisma.facilityTariff.upsert({
      where: {
        facility_id_service_id: {
          facility_id: facilityId,
          service_id: serviceId
        }
      },
      update: { 
        price: parseFloat(price),
        updated_at: new Date()
      },
      create: {
        facility_id: facilityId,
        service_id: serviceId,
        price: parseFloat(price)
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Price updated successfully',
      data: {
        tariff_id: tariff.id,
        facility_id: facilityId,
        service_id: serviceId,
        price: tariff.price,
        facility_name: facility.facility_name,
        service_name: service.service_name,
        updated_at: tariff.updated_at
      }
    })

  } catch (error) {
    console.error('Error updating facility tariff:', error)
    return NextResponse.json(
      { error: 'Failed to update facility tariff' },
      { status: 500 }
    )
  }
}
