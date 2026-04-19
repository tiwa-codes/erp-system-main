import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const serviceTypeSchema = z.object({
  service_name: z.string().min(1, "Service name is required"),
  service_category: z.string().min(1, "Service category is required"),
  service_type: z.enum(["PRIMARY_SERVICE", "SECONDARY_SERVICE"]).optional(),
  nhia_price: z.preprocess((val) => val ? parseFloat(String(val)) : 0, z.number().optional()),
  is_nhia_service: z.boolean().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has settings permissions
    const hasPermission = await checkPermission(session.user.role as any, "settings", "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = serviceTypeSchema.parse(body)

    // Convert category ID to category name if needed
    const categories = [
      { "name": "Consultation", "id": "CON" },
      { "name": "Laboratory Services", "id": "LAB" },
      { "name": "Radiology / Imaging", "id": "RAD" },
      { "name": "Drugs / Pharmaceuticals", "id": "DRG" },
      { "name": "Procedures / Surgeries", "id": "PRC" },
      { "name": "Dental Services", "id": "DEN" },
      { "name": "Eye Care / Optometry", "id": "EYE" },
      { "name": "Physiotherapy", "id": "PHY" },
      { "name": "Maternity / Obstetrics", "id": "MAT" },
      { "name": "Paediatrics", "id": "PED" },
      { "name": "Emergency Services", "id": "EMG" },
      { "name": "Admission / Inpatient", "id": "ADM" },
      { "name": "Consumables / Supplies", "id": "CNS" },
      { "name": "Others / Special Services", "id": "OTH" }
    ]

    // Check if the provided category is an ID or a name
    const categoryObj = categories.find(c => c.id === validatedData.service_category)
    const categoryName = categoryObj?.name || validatedData.service_category

    // Check if service type exists
    const existingService = await prisma.serviceType.findUnique({
      where: { id: params.id }
    })

    if (!existingService) {
      return NextResponse.json(
        { error: "Service type not found" },
        { status: 404 }
      )
    }

    // Check if another service type with same name, category and type exists (check with both ID and name)
    const duplicateService = await prisma.serviceType.findFirst({
      where: {
        service_name: validatedData.service_name,
        OR: [
          { service_category: validatedData.service_category },
          { service_category: categoryName }
        ],
        service_type: validatedData.service_type || null,
        id: { not: params.id }
      }
    })

    if (duplicateService) {
      return NextResponse.json(
        { error: "Service type with this name, category and type already exists" },
        { status: 400 }
      )
    }

    const serviceType = await prisma.serviceType.update({
      where: { id: params.id },
      data: {
        service_name: validatedData.service_name,
        service_category: categoryName, // Store category name, not ID
        service_type: validatedData.service_type,
        nhia_price: validatedData.nhia_price || 0,
        is_nhia_service: validatedData.is_nhia_service || false,
      }
    })

    return NextResponse.json({
      success: true,
      serviceType
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error updating service type:", error)
    return NextResponse.json(
      { error: "Failed to update service type" },
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
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has settings permissions
    const hasPermission = await checkPermission(session.user.role as any, "settings", "delete")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Check if service type exists
    const existingService = await prisma.serviceType.findUnique({
      where: { id: params.id }
    })

    if (!existingService) {
      return NextResponse.json(
        { error: "Service type not found" },
        { status: 404 }
      )
    }

    // Check if service type is being used in covered services
    const coveredServicesCount = await prisma.coveredService.count({
      where: { service_type_id: params.id }
    })

    if (coveredServicesCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete service type that is being used in covered services" },
        { status: 400 }
      )
    }

    await prisma.serviceType.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      success: true,
      message: "Service type deleted successfully"
    })

  } catch (error) {
    console.error("Error deleting service type:", error)
    return NextResponse.json(
      { error: "Failed to delete service type" },
      { status: 500 }
    )
  }
}
