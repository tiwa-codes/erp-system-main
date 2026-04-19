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

    // Check if user has call-centre permissions
    const hasPermission = await checkPermission(session.user.role as any, "call-centre", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.OR = [
        { enrollee_id: { contains: search, mode: "insensitive" } },
        { first_name: { contains: search, mode: "insensitive" } },
        { last_name: { contains: search, mode: "insensitive" } },
        { phone_number: { contains: search, mode: "insensitive" } },
      ]
    }

    const [enrollees, total] = await Promise.all([
      prisma.principalAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { first_name: 'asc' },
        include: {
          organization: {
            select: {
              id: true,
              name: true
            }
          },
          plan: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }),
      prisma.principalAccount.count({ where })
    ])

    // Format enrollees
    const formattedEnrollees = enrollees.map(enrollee => ({
      id: enrollee.id,
      enrollee_id: enrollee.enrollee_id,
      name: `${enrollee.first_name} ${enrollee.last_name}`,
      plan: enrollee.plan?.name || 'No Plan',
      phone_number: enrollee.phone_number,
      region: enrollee.organization?.name || 'Individual',
      status: enrollee.status,
      date_added: enrollee.created_at
    }))

    return NextResponse.json({
      success: true,
      enrollees: formattedEnrollees,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error("Error fetching enrollees:", error)
    return NextResponse.json(
      { error: "Failed to fetch enrollees" },
      { status: 500 }
    )
  }
}
