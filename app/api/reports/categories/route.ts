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

    // Check if user has reports permissions
    const hasPermission = await checkPermission(session.user.role as any, "reports", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Mock categories - in a real system, this would come from a categories table
    const categories = [
      { id: "financial", name: "Financial" },
      { id: "claims", name: "Claims" },
      { id: "provider", name: "Provider" },
      { id: "enrollee", name: "Enrollee" },
      { id: "analytics", name: "Analytics" },
      { id: "utilization", name: "Utilization" },
      { id: "performance", name: "Performance" },
      { id: "compliance", name: "Compliance" }
    ]

    return NextResponse.json({
      success: true,
      categories
    })

  } catch (error) {
    console.error("Error fetching categories:", error)
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    )
  }
}
