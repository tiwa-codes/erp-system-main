import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { OrganizationStatus } from "@prisma/client"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has organization edit permissions
    const canEdit = await checkPermission(session.user.role as any, "underwriting", "edit")
    if (!canEdit) {
      return NextResponse.json({ error: "Insufficient permissions to change organization status" }, { status: 403 })
    }

    const body = await request.json()
    const { status, reason } = body

    if (!status || !["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status. Must be 'ACTIVE', 'INACTIVE', or 'SUSPENDED'" }, { status: 400 })
    }

    // Find the organization
    const organization = await prisma.organization.findUnique({
      where: { id: params.id }
    })

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    // Check if status is actually changing
    if (organization.status === status) {
      return NextResponse.json({ 
        error: `Organization is already ${status.toLowerCase()}` 
      }, { status: 400 })
    }

    // Update organization status
    const updatedOrganization = await prisma.organization.update({
      where: { id: params.id },
      data: {
        status: status as OrganizationStatus,
        updated_at: new Date()
      }
    })

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: `ORGANIZATION_STATUS_CHANGE`,
        resource: "organization",
        resource_id: organization.id,
        old_values: {
          status: organization.status,
          name: organization.name,
          code: organization.code
        },
        new_values: {
          status: status,
          name: organization.name,
          code: organization.code,
          reason: reason || "Status changed by administrator"
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `Organization status changed to ${status.toLowerCase()} successfully`,
      organization: updatedOrganization
    })

  } catch (error) {
    console.error("Error changing organization status:", error)
    return NextResponse.json(
      { error: "Failed to change organization status" },
      { status: 500 }
    )
  }
}
