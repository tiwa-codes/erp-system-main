import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/claims/[id]/vetting-actions
 * Returns all vetting actions for a claim, ordered by created_at ascending.
 * Each action includes the full service_verdicts JSON (which holds modified_by_name
 * and quantity per service as serialised by the vetting page on submit).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const actions = await prisma.vettingAction.findMany({
      where: { claim_id: params.id },
      orderBy: { created_at: "asc" },
      select: {
        id: true,
        stage: true,
        action: true,
        comments: true,
        service_verdicts: true,
        created_at: true,
        action_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ actions })
  } catch (error) {
    console.error("[vetting-actions] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
