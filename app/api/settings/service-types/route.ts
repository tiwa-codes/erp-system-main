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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has settings permissions, provider tariff plan permissions, or telemedicine permissions
    // Telemedicine users need to search for services when creating orders
    const hasSettingsPermission = await checkPermission(session.user.role as any, "settings", "view")
    const hasTariffPlanPermission = await checkPermission(session.user.role as any, "provider", "manage_tariff_plan")
    const hasTelemedicinePermission = await checkPermission(session.user.role as any, "telemedicine", "view")

    if (!hasSettingsPermission && !hasTariffPlanPermission && !hasTelemedicinePermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const category = searchParams.get("category") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limitParam = searchParams.get("limit") || "100"
    const limit = parseInt(limitParam)
    // For very high limits (>= 10000), bypass pagination to get all results
    const shouldBypassPagination = limit >= 10000
    const skip = shouldBypassPagination ? 0 : (page - 1) * limit
    const take = shouldBypassPagination ? undefined : limit

    // Build where clause with category filter
    const whereConditions: any[] = []

    // Add category filter if provided
    if (category) {
      // Load categories from JSON file to get the correct category name
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

      const categoryObj = categories.find(c => c.id === category)
      const categoryName = categoryObj?.name || category

      // Match by both category name and category ID (for backward compatibility with old data)
      // This handles cases where services might have been stored with category ID instead of name
      whereConditions.push({
        OR: [
          {
            service_category: {
              equals: categoryName,
              mode: 'insensitive'
            }
          },
          {
            service_category: {
              equals: category,
              mode: 'insensitive'
            }
          }
        ]
      })
    }

    // Add search filter if provided
    if (search) {
      whereConditions.push({
        OR: [
          { service_name: { contains: search, mode: 'insensitive' } },
          { service_category: { contains: search, mode: 'insensitive' } },
          // For enum fields, we need to check if the search term matches enum values
          ...(search.toUpperCase() === 'PRIMARY' || search.toUpperCase() === 'PRIMARY_SERVICE' ?
            [{ service_type: 'PRIMARY_SERVICE' }] : []),
          ...(search.toUpperCase() === 'SECONDARY' || search.toUpperCase() === 'SECONDARY_SERVICE' ?
            [{ service_type: 'SECONDARY_SERVICE' }] : []),
        ]
      })
    }

    const where = whereConditions.length > 0 ? {
      AND: whereConditions
    } : {}

    // Get total count for pagination
    const totalCount = await prisma.serviceType.count({ where })

    // Build query conditionally - if bypassing pagination, don't include skip/take
    const queryOptions: any = {
      where,
      orderBy: {
        created_at: 'desc'
      }
    }

    if (!shouldBypassPagination) {
      queryOptions.skip = skip
      queryOptions.take = take
    }

    const serviceTypes = await prisma.serviceType.findMany(queryOptions)

    const totalPages = shouldBypassPagination ? 1 : Math.ceil(totalCount / limit)

    return NextResponse.json({
      success: true,
      serviceTypes,
      totalCount,
      pagination: {
        page: shouldBypassPagination ? 1 : page,
        limit: shouldBypassPagination ? totalCount : limit,
        total: totalCount,
        pages: totalPages
      }
    })

  } catch (error) {
    console.error("Error fetching service types:", error)
    return NextResponse.json(
      { error: "Failed to fetch service types" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has settings permissions
    const hasPermission = await checkPermission(session.user.role as any, "settings", "add")
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

    // Check if service type already exists (check with both ID and name for backward compatibility)
    const existingService = await prisma.serviceType.findFirst({
      where: {
        service_name: validatedData.service_name,
        OR: [
          { service_category: validatedData.service_category },
          { service_category: categoryName }
        ],
        service_type: validatedData.service_type || null
      }
    })

    if (existingService) {
      return NextResponse.json(
        { error: "Service type with this name, category and type already exists" },
        { status: 400 }
      )
    }

    // Generate a unique service_id using timestamp + random number
    const generateServiceId = () => {
      const timestamp = Date.now().toString()
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
      return `${timestamp}${random}`
    }

    // Create service type with unique service_id (store category name, not ID)
    const serviceType = await prisma.serviceType.create({
      data: {
        service_id: generateServiceId(),
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

    console.error("Error creating service type:", error)

    // Check for Prisma unique constraint error
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      const target = (error as any).meta?.target
      if (target && target.includes('service_id')) {
        return NextResponse.json(
          { error: "Service ID already exists. Please try again." },
          { status: 400 }
        )
      }
      if (target && target.includes('service_name')) {
        return NextResponse.json(
          { error: "Service name already exists. Please choose a different name." },
          { status: 400 }
        )
      }
    }

    // Generic error message
    return NextResponse.json(
      { error: "Failed to create service type. Please try again." },
      { status: 500 }
    )
  }
}
