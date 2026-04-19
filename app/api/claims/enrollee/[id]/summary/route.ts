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

    // Get all claims for this enrollee
    const claims = await prisma.claim.findMany({
      where: {
        enrollee_id: params.id
      },
      select: {
        original_amount: true,
        approved_amount: true,
        amount: true
      }
    })

    // Calculate totals
    const originalPrice = claims.reduce(
      (sum, claim) => sum + Number(claim.original_amount || claim.amount),
      0
    )

    const approvedPrice = claims.reduce(
      (sum, claim) => sum + Number(claim.approved_amount || claim.amount || 0),
      0
    )

    return NextResponse.json({
      success: true,
      originalPrice,
      approvedPrice
    })
  } catch (error) {
    console.error("Error fetching enrollee claims summary:", error)
    return NextResponse.json(
      { error: "Failed to fetch summary" },
      { status: 500 }
    )
  }
}









