import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [hasManagePermission, hasApprovePermission] = await Promise.all([
      checkPermission(session.user.role as any, "provider", "manage_tariff_plan"),
      checkPermission(session.user.role as any, "provider", "approve_tariff_plan"),
    ])

    if (!hasManagePermission && !hasApprovePermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const {
      service_id,
      service_name,
      category_id,
      price,
      original_price,
      is_primary,
      is_secondary
    } = body

    // Check if service exists
    const existingService = await prisma.tariffPlanService.findUnique({
      where: { id },
      include: {
        tariff_plan: true,
      },
    })

    if (!existingService) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 404 }
      )
    }

    // Check if tariff plan allows editing.
    // During tariff negotiation, UNDERWRITING users can still adjust both tariff columns
    // while the plan is pending approval.
    const planStatus = (existingService.tariff_plan?.status || "").toUpperCase()
    const approvalStage = (existingService.tariff_plan?.approval_stage || "").toUpperCase()
    const canEditByStatus = ["DRAFT", "REJECTED", "IN_PROGRESS"].includes(planStatus)
    const canEditDuringNegotiation =
      planStatus === "PENDING_APPROVAL" && approvalStage === "UNDERWRITING"

    if (existingService.tariff_plan && !canEditByStatus && !canEditDuringNegotiation) {
      return NextResponse.json(
        { error: "Cannot edit service at this stage" },
        { status: 400 }
      )
    }

    const updateData: any = {}

    if (typeof service_id === "string" && service_id.trim()) {
      updateData.service_id = service_id.trim()
    }

    if (typeof service_name === "string" && service_name.trim()) {
      updateData.service_name = service_name.trim()
    }

    if (typeof category_id === "string" && category_id.trim()) {
      updateData.category_id = category_id.trim()
      updateData.category_name = getCategoryName(category_id.trim())
    }

    const hasExplicitOriginalPrice = original_price !== undefined

    if (price !== undefined) {
      const parsedPrice = Number(price)
      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        return NextResponse.json(
          { error: "Invalid price value" },
          { status: 400 }
        )
      }

      updateData.price = parsedPrice

      // Keep existing provider-customization behavior only when original_price
      // is not explicitly passed.
      if (!hasExplicitOriginalPrice) {
        if (existingService.original_price == null && parsedPrice !== existingService.price) {
          updateData.original_price = existingService.price
        }

        const previousOriginal =
          existingService.original_price != null ? Number(existingService.original_price) : null
        if (previousOriginal != null && parsedPrice === previousOriginal) {
          updateData.original_price = null
        }
      }
    }

    if (original_price !== undefined) {
      if (original_price === null || original_price === "") {
        updateData.original_price = null
      } else {
        const parsedOriginalPrice = Number(original_price)
        if (Number.isNaN(parsedOriginalPrice) || parsedOriginalPrice < 0) {
          return NextResponse.json(
            { error: "Invalid original price value" },
            { status: 400 }
          )
        }
        updateData.original_price = parsedOriginalPrice
      }
    }

    if (is_primary !== undefined) {
      updateData.is_primary = Boolean(is_primary)
    }

    if (is_secondary !== undefined) {
      updateData.is_secondary = Boolean(is_secondary)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update" },
        { status: 400 }
      )
    }

    // Update tariff plan service in database
    const updatedService = await prisma.tariffPlanService.update({
      where: { id },
      data: updateData
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "TARIFF_PLAN_SERVICE_UPDATE",
        resource: "tariff_plan_service",
        resource_id: updatedService.id,
        old_values: existingService,
        new_values: updatedService,
      },
    })

    return NextResponse.json({
      success: true,
      service: updatedService
    })

  } catch (error) {
    console.error("Error updating tariff plan service:", error)
    return NextResponse.json(
      { error: "Failed to update tariff plan service" },
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

    const hasPermission = await checkPermission(session.user.role as any, "provider", "manage_tariff_plan")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params

    // Check if service exists
    const existingService = await prisma.tariffPlanService.findUnique({
      where: { id },
      include: {
        tariff_plan: true,
      },
    })

    if (!existingService) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 404 }
      )
    }

    // Check if tariff plan allows deletion
    if (existingService.tariff_plan && 
        existingService.tariff_plan.status !== "DRAFT" && 
        existingService.tariff_plan.status !== "REJECTED") {
      return NextResponse.json(
        { error: "Cannot delete service. Tariff plan must be in DRAFT or REJECTED status" },
        { status: 400 }
      )
    }

    // Delete tariff plan service from database (junction table entries will be deleted via cascade)
    await prisma.tariffPlanService.delete({
      where: { id }
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "TARIFF_PLAN_SERVICE_DELETE",
        resource: "tariff_plan_service",
        resource_id: id,
        old_values: existingService,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Service deleted successfully"
    })

  } catch (error) {
    console.error("Error deleting tariff plan service:", error)
    return NextResponse.json(
      { error: "Failed to delete tariff plan service" },
      { status: 500 }
    )
  }
}

function getCategoryName(categoryId: string): string {
  const categories: Record<string, string> = {
    'CON': 'Consultation',
    'LAB': 'Laboratory Services',
    'RAD': 'Radiology / Imaging',
    'DRG': 'Drugs / Pharmaceuticals',
    'PRC': 'Procedures / Surgeries',
    'DEN': 'Dental Services',
    'EYE': 'Eye Care / Optometry',
    'PHY': 'Physiotherapy',
    'MAT': 'Maternity / Obstetrics',
    'PED': 'Paediatrics',
    'EMG': 'Emergency Services',
    'ADM': 'Admission / Inpatient',
    'CNS': 'Consumables / Supplies',
    'OTH': 'Others / Special Services'
  }
  return categories[categoryId] || categoryId
}