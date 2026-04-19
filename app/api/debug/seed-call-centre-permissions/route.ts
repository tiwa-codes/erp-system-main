import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function POST(request: NextRequest) {
  try {
    void request

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only allow SUPER_ADMIN to seed permissions
    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Define call-centre permissions for different roles
    const roleNames = ["SUPER_ADMIN", "ADMIN", "CLAIMS_MANAGER", "CLAIMS_PROCESSOR"] as const
    const roles = await prisma.role.findMany({
      where: { name: { in: [...roleNames] } },
      select: { id: true, name: true }
    })
    const roleIdMap = new Map(roles.map((role) => [role.name, role.id]))

    const rawPermissions = [
      // SUPER_ADMIN - full access
      { role: 'SUPER_ADMIN', module: 'call-centre', action: 'view', allowed: true },
      { role: 'SUPER_ADMIN', module: 'call-centre', action: 'add', allowed: true },
      { role: 'SUPER_ADMIN', module: 'call-centre', action: 'edit', allowed: true },
      { role: 'SUPER_ADMIN', module: 'call-centre', action: 'delete', allowed: true },
      { role: 'SUPER_ADMIN', module: 'call-centre', action: 'manage_requests', allowed: true },
      { role: 'SUPER_ADMIN', module: 'call-centre', action: 'verify_codes', allowed: true },
      { role: 'SUPER_ADMIN', module: 'call-centre', action: 'check_coverage', allowed: true },
      
      // ADMIN - full access
      { role: 'ADMIN', module: 'call-centre', action: 'view', allowed: true },
      { role: 'ADMIN', module: 'call-centre', action: 'add', allowed: true },
      { role: 'ADMIN', module: 'call-centre', action: 'edit', allowed: true },
      { role: 'ADMIN', module: 'call-centre', action: 'manage_requests', allowed: true },
      { role: 'ADMIN', module: 'call-centre', action: 'verify_codes', allowed: true },
      { role: 'ADMIN', module: 'call-centre', action: 'check_coverage', allowed: true },
      
      // CLAIMS_MANAGER - full access
      { role: 'CLAIMS_MANAGER', module: 'call-centre', action: 'view', allowed: true },
      { role: 'CLAIMS_MANAGER', module: 'call-centre', action: 'add', allowed: true },
      { role: 'CLAIMS_MANAGER', module: 'call-centre', action: 'edit', allowed: true },
      { role: 'CLAIMS_MANAGER', module: 'call-centre', action: 'manage_requests', allowed: true },
      { role: 'CLAIMS_MANAGER', module: 'call-centre', action: 'verify_codes', allowed: true },
      { role: 'CLAIMS_MANAGER', module: 'call-centre', action: 'check_coverage', allowed: true },
      
      // CLAIMS_PROCESSOR - limited access
      { role: 'CLAIMS_PROCESSOR', module: 'call-centre', action: 'view', allowed: true },
      { role: 'CLAIMS_PROCESSOR', module: 'call-centre', action: 'add', allowed: true },
      { role: 'CLAIMS_PROCESSOR', module: 'call-centre', action: 'edit', allowed: true },
      { role: 'CLAIMS_PROCESSOR', module: 'call-centre', action: 'verify_codes', allowed: true },
      { role: 'CLAIMS_PROCESSOR', module: 'call-centre', action: 'check_coverage', allowed: true },
    ]

    const callCentrePermissions = rawPermissions.reduce<Prisma.PermissionCreateManyInput[]>(
      (acc, permission) => {
        const roleId = roleIdMap.get(permission.role)
        if (!roleId) return acc

        acc.push({
          role_id: roleId,
          module: permission.module,
          action: permission.action,
          allowed: permission.allowed,
        })

        return acc
      },
      []
    )

    // Create permissions in database
    await prisma.permission.createMany({
      data: callCentrePermissions,
      skipDuplicates: true
    })

    return NextResponse.json({
      success: true,
      message: "Call centre permissions seeded successfully",
      count: callCentrePermissions.length
    })

  } catch (error) {
    console.error("Error seeding call centre permissions:", error)
    return NextResponse.json(
      { error: "Failed to seed call centre permissions" },
      { status: 500 }
    )
  }
}
