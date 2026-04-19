import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { canTakeAction, VettingStage } from "@/lib/claims/vetting-workflow"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const stage = searchParams.get("stage") as VettingStage

    if (!stage || !['vetter1', 'vetter2', 'audit', 'approval'].includes(stage)) {
      return NextResponse.json(
        { error: "Invalid stage parameter" },
        { status: 400 }
      )
    }

    const result = await canTakeAction(params.id, stage, session.user.id)

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error("Error checking action permission:", error)
    return NextResponse.json(
      { error: "Failed to check action permission" },
      { status: 500 }
    )
  }
}









