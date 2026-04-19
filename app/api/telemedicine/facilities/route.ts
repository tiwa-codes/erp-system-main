import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has telemedicine permissions
    const hasPermission = await checkPermission(session.user.role as any, "telemedicine", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const facility_type = searchParams.get("facility_type") || ""

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.OR = [
        { facility_name: { contains: search, mode: "insensitive" } },
        { phone_number: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } }
      ]
    }

    if (facility_type && facility_type !== "all") {
      where.facility_type = facility_type
    }

    const [facilities, total] = await Promise.all([
      prisma.telemedicineFacility.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" }
      }),
      prisma.telemedicineFacility.count({ where })
    ])

    return NextResponse.json({
      success: true,
      facilities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error("Error fetching facilities:", error)
    return NextResponse.json(
      { error: "Failed to fetch facilities" },
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

    // Check if user has telemedicine permissions
    const hasPermission = await checkPermission(session.user.role as any, "telemedicine", "add")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const {
      facility_name,
      phone_number,
      email,
      facility_type,
      selected_bands
    } = body

    if (!facility_name || !phone_number || !email || !facility_type) {
      return NextResponse.json({ 
        error: "Facility name, phone number, email, and facility type are required" 
      }, { status: 400 })
    }

    if (!selected_bands || selected_bands.length === 0) {
      return NextResponse.json({ 
        error: "At least one band must be selected for this facility" 
      }, { status: 400 })
    }

    // Create facility
    const facility = await prisma.telemedicineFacility.create({
      data: {
        facility_name,
        phone_number,
        email,
        facility_type: facility_type as any,
        selected_bands: selected_bands,
        status: 'ACTIVE'
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "TELEMEDICINE_FACILITY_CREATE",
        resource: "telemedicine_facility",
        resource_id: facility.id,
        new_values: facility
      }
    })

    return NextResponse.json({
      success: true,
      facility
    }, { status: 201 })

  } catch (error) {
    console.error("Error creating facility:", error)
    return NextResponse.json(
      { error: "Failed to create facility" },
      { status: 500 }
    )
  }
}
