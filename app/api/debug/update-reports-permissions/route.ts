import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { invalidatePermissionCache } from "@/lib/permissions"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only allow super admin to run this
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Clear permission cache
    invalidatePermissionCache()

    // Get all roles
    const roles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "HR_OFFICER", "CLAIMS_MANAGER", "CLAIMS_PROCESSOR", "FINANCE_OFFICER", "PROVIDER_MANAGER", "UNDERWRITER"]

    // Delete existing permissions for reports module
    await prisma.permission.deleteMany({
      where: {
        module: "reports"
      }
    })

    // Define permissions for each role
    const rolePermissions: { [key: string]: string[] } = {
      "SUPER_ADMIN": ["view", "generate_all", "view_all"],
      "ADMIN": ["view", "generate_all", "view_all"],
      "HR_MANAGER": ["view", "generate_hr"],
      "HR_OFFICER": ["view", "generate_hr"],
      "CLAIMS_MANAGER": ["view", "generate_claims"],
      "CLAIMS_PROCESSOR": ["view", "generate_claims"],
      "FINANCE_OFFICER": ["view", "generate_finance"],
      "PROVIDER_MANAGER": ["view", "generate_provider"],
      "UNDERWRITER": ["view", "generate_underwriting"]
    }

    // Create permissions for each role
    for (const role of roles) {
      const permissions = rolePermissions[role] || []
      
      for (const action of permissions) {
        await prisma.permission.create({
          data: {
            role: role as any,
            module: "reports",
            action: action
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: "Reports permissions updated successfully",
      rolesUpdated: roles.length,
      permissionsCreated: Object.values(rolePermissions).flat().length
    })

  } catch (error) {
    console.error("Error updating reports permissions:", error)
    return NextResponse.json(
      { error: "Failed to update reports permissions" },
      { status: 500 }
    )
  }
}
