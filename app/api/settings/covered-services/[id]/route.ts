import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const coveredServiceSchema = z.object({
  plan_id: z.string().min(1, "Plan is required").optional(),
  facility_id: z.string().min(1, "Facility is required").optional(),
  service_type_id: z.string().min(1, "Service type is required").optional(),
  facility_price: z.number().min(0, "Facility price must be positive").optional(),
  limit_count: z.number().optional(),
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
    const validatedData = coveredServiceSchema.parse(body)

    // Check if covered service exists
    const existingService = await prisma.coveredService.findUnique({
      where: { id: params.id }
    })

    if (!existingService) {
      return NextResponse.json(
        { error: "Covered service not found" },
        { status: 404 }
      )
    }

    // Only check for duplicates if plan_id, facility_id, or service_type_id are being updated
    if (validatedData.plan_id || validatedData.facility_id || validatedData.service_type_id) {
      const duplicateService = await prisma.coveredService.findFirst({
        where: {
          plan_id: validatedData.plan_id || existingService.plan_id,
          facility_id: validatedData.facility_id || existingService.facility_id,
          service_type_id: validatedData.service_type_id || existingService.service_type_id,
          id: { not: params.id }
        }
      })

      if (duplicateService) {
        return NextResponse.json(
          { error: "Covered service already exists for this plan, facility, and service type" },
          { status: 400 }
        )
      }
    }

    // Build update data object with only provided fields
    const updateData: any = {}
    if (validatedData.plan_id !== undefined) updateData.plan_id = validatedData.plan_id
    if (validatedData.facility_id !== undefined) updateData.facility_id = validatedData.facility_id
    if (validatedData.service_type_id !== undefined) updateData.service_type_id = validatedData.service_type_id
    if (validatedData.facility_price !== undefined) updateData.facility_price = validatedData.facility_price
    if (validatedData.limit_count !== undefined) updateData.limit_count = validatedData.limit_count

    const coveredService = await prisma.coveredService.update({
      where: { id: params.id },
      data: updateData,
      include: {
        plan: {
          select: {
            name: true
          }
        },
        facility: {
          select: {
            facility_name: true,
            hcp_code: true
          }
        },
        service_type: {
          select: {
            service_name: true,
            service_category: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      coveredService
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error updating covered service:", error)
    return NextResponse.json(
      { error: "Failed to update covered service" },
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

    // Check if covered service exists
    const existingService = await prisma.coveredService.findUnique({
      where: { id: params.id }
    })

    if (!existingService) {
      return NextResponse.json(
        { error: "Covered service not found" },
        { status: 404 }
      )
    }

    await prisma.coveredService.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      success: true,
      message: "Covered service deleted successfully"
    })

  } catch (error) {
    console.error("Error deleting covered service:", error)
    return NextResponse.json(
      { error: "Failed to delete covered service" },
      { status: 500 }
    )
  }
}
