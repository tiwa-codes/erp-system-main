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
    const where: any = {
      status: 'PENDING' // Only show pending requests
    }
    
    if (search) {
      where.OR = [
        { test_name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { enrollee: { 
          OR: [
            { enrollee_id: { contains: search, mode: "insensitive" } },
            { first_name: { contains: search, mode: "insensitive" } },
            { last_name: { contains: search, mode: "insensitive" } }
          ]
        }},
        { facility: { facility_name: { contains: search, mode: "insensitive" } } }
      ]
    }

    const [telemedicineRequests, total] = await Promise.all([
      prisma.telemedicineRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          enrollee: {
            select: {
              id: true,
              enrollee_id: true,
              first_name: true,
              last_name: true,
              phone_number: true
            }
          },
          facility: {
            select: {
              id: true,
              facility_name: true,
              facility_type: true
            }
          },
          created_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true
            }
          },
          appointment: {
            select: {
              id: true,
              scheduled_date: true,
              reason: true
            }
          }
        }
      }),
      prisma.telemedicineRequest.count({ where })
    ])

    return NextResponse.json({
      success: true,
      telemedicineRequests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching telemedicine requests:", error)
    return NextResponse.json(
      { error: "Failed to fetch telemedicine requests" },
      { status: 500 }
    )
  }
}
