import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; categoryId: string; serviceId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, limit_type, limit_value, limit_frequency, coverage_status } = body

    const service = await prisma.benefitService.findUnique({
      where: { id: params.serviceId }
    })

    if (!service || service.category_id !== params.categoryId) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    const updated = await prisma.benefitService.update({
      where: { id: params.serviceId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(limit_type && { limit_type }),
        ...(limit_type === "PRICE" && limit_value !== undefined && { limit_value: parseFloat(limit_value) }),
        ...(limit_type === "FREQUENCY" && limit_frequency !== undefined && { limit_frequency }),
        ...(coverage_status && { coverage_status })
      }
    })

    return NextResponse.json({ service: updated }, { status: 200 })
  } catch (err: any) {
    console.error(`PUT /api/settings/benefit-packages/[id]/categories/[categoryId]/services/[serviceId] error:`, err)
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; categoryId: string; serviceId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const service = await prisma.benefitService.findUnique({
      where: { id: params.serviceId }
    })

    if (!service || service.category_id !== params.categoryId) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    // Soft delete
    await prisma.benefitService.update({
      where: { id: params.serviceId },
      data: { is_active: false }
    })

    return NextResponse.json({ message: "Service deleted successfully" }, { status: 200 })
  } catch (err: any) {
    console.error(`DELETE /api/settings/benefit-packages/[id]/categories/[categoryId]/services/[serviceId] error:`, err)
    return NextResponse.json({ error: "Failed to delete service" }, { status: 500 })
  }
}
