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

    // Check if user has finance permissions
    const hasPermission = await checkPermission(session.user.role as any, "finance", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Fetch enrollees (principals and dependents)
    const principals = await prisma.principalAccount.findMany({
      select: {
        id: true,
        enrollee_id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
        organization: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        first_name: 'asc'
      }
    })

    const dependents = await prisma.dependent.findMany({
      select: {
        id: true,
        dependent_id: true,
        first_name: true,
        last_name: true,
        principal: {
          select: {
            first_name: true,
            last_name: true,
            organization: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        first_name: 'asc'
      }
    })

    // Format enrollees data
    const enrollees = [
      ...principals.map(principal => ({
        id: principal.id,
        name: `${principal.first_name} ${principal.last_name}`,
        email: principal.email,
        phone: principal.phone_number,
        organization: principal.organization?.name || 'Individual',
        type: 'Principal'
      })),
      ...dependents.map(dependent => ({
        id: dependent.id,
        name: `${dependent.first_name} ${dependent.last_name}`,
        email: '',
        phone: '',
        organization: dependent.principal.organization?.name || 'Individual',
        type: 'Dependent',
        principal_name: `${dependent.principal.first_name} ${dependent.principal.last_name}`
      }))
    ]

    return NextResponse.json({
      success: true,
      enrollees
    })

  } catch (error) {
    console.error("Error fetching enrollees:", error)
    return NextResponse.json(
      { error: "Failed to fetch enrollees" },
      { status: 500 }
    )
  }
}
