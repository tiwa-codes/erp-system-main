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
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has telemedicine permissions
    const hasPermission = await checkPermission(session.user.role as any, "telemedicine", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = params

    const facility = await prisma.telemedicineFacility.findUnique({
      where: { id }
    })

    if (!facility) {
      return NextResponse.json({ 
        error: "Facility not found" 
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      facility
    })

  } catch (error) {
    console.error("Error fetching facility:", error)
    return NextResponse.json(
      { error: "Failed to fetch facility" },
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
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has telemedicine permissions
    const hasPermission = await checkPermission(session.user.role as any, "telemedicine", "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = params
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

    // Check if facility exists
    const existingFacility = await prisma.telemedicineFacility.findUnique({
      where: { id }
    })

    if (!existingFacility) {
      return NextResponse.json({ 
        error: "Facility not found" 
      }, { status: 404 })
    }

    // Update facility
    const updatedFacility = await prisma.telemedicineFacility.update({
      where: { id },
      data: {
        facility_name,
        phone_number,
        email,
        facility_type: facility_type as any,
        selected_bands: selected_bands
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "TELEMEDICINE_FACILITY_UPDATE",
        resource: "telemedicine_facility",
        resource_id: updatedFacility.id,
        old_values: existingFacility,
        new_values: updatedFacility
      }
    })

    return NextResponse.json({
      success: true,
      facility: updatedFacility
    })

  } catch (error) {
    console.error("Error updating facility:", error)
    return NextResponse.json(
      { error: "Failed to update facility" },
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

    // Check if user has telemedicine permissions
    const hasPermission = await checkPermission(session.user.role as any, "telemedicine", "delete")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = params

    // Check if facility exists
    const existingFacility = await prisma.telemedicineFacility.findUnique({
      where: { id }
    })

    if (!existingFacility) {
      return NextResponse.json({ 
        error: "Facility not found" 
      }, { status: 404 })
    }

    // Delete related records first (to avoid foreign key constraint violations)
    await prisma.labOrder.deleteMany({
      where: { facility_id: id }
    })

    await prisma.radiologyOrder.deleteMany({
      where: { facility_id: id }
    })

    await prisma.pharmacyOrder.deleteMany({
      where: { facility_id: id }
    })

    await prisma.telemedicineRequest.deleteMany({
      where: { facility_id: id }
    })

    // Delete facility
    await prisma.telemedicineFacility.delete({
      where: { id }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "TELEMEDICINE_FACILITY_DELETE",
        resource: "telemedicine_facility",
        resource_id: id,
        old_values: existingFacility
      }
    })

    return NextResponse.json({
      success: true,
      message: "Facility deleted successfully"
    })

  } catch (error) {
    console.error("Error deleting facility:", error)
    return NextResponse.json(
      { error: "Failed to delete facility" },
      { status: 500 }
    )
  }
}
