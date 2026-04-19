import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get price edit history
    const edits = await prisma.priceEdit.findMany({
      where: {
        claim_id: params.id
      },
      include: {
        edited_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      edits: edits
    })
  } catch (error) {
    console.error("Error fetching price history:", error)
    return NextResponse.json(
      { error: "Failed to fetch price history" },
      { status: 500 }
    )
  }
}









