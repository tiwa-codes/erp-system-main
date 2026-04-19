import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get departments from database
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        manager_id: true,
        created_at: true,
        updated_at: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      departments
    })

  } catch (error) {
    console.error("Error fetching departments:", error)
    return NextResponse.json(
      { error: "Failed to fetch departments" },
      { status: 500 }
    )
  }
}
