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

    const hasPermission = await checkPermission(session.user.role as any, "legal", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const msas = await prisma.mSA.findMany({
      include: {
        provider: {
          select: {
            id: true,
            facility_name: true,
            email: true,
          },
        },
        tariff_plan: {
          select: {
            id: true,
            version: true,
            status: true,
          },
        },
        generated_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    })

    return NextResponse.json({
      success: true,
      msas,
    })
  } catch (error) {
    console.error("Error fetching MSAs:", error)
    return NextResponse.json(
      { error: "Failed to fetch MSAs" },
      { status: 500 }
    )
  }
}

