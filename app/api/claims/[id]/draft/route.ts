import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { VettingStage } from "@/lib/claims/vetting-workflow"
import { Prisma } from "@prisma/client"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { stage, draftData } = body

    if (!stage || !['vetter1', 'vetter2', 'audit', 'approval'].includes(stage)) {
      return NextResponse.json(
        { error: "Invalid stage parameter" },
        { status: 400 }
      )
    }

    if (!draftData) {
      return NextResponse.json(
        { error: "Draft data is required" },
        { status: 400 }
      )
    }

    // Update first to avoid unique-key races from rapid autosave requests.
    const updateResult = await prisma.vettingDraft.updateMany({
      where: {
        claim_id: params.id,
        stage,
        saved_by_id: session.user.id
      },
      data: {
        draft_data: draftData,
        updated_at: new Date()
      }
    })

    if (updateResult.count === 0) {
      try {
        await prisma.vettingDraft.create({
          data: {
            claim_id: params.id,
            stage: stage as VettingStage,
            draft_data: draftData,
            saved_by_id: session.user.id
          }
        })
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
          throw error
        }

        // Another autosave created the row between updateMany and create.
        await prisma.vettingDraft.updateMany({
          where: {
            claim_id: params.id,
            stage,
            saved_by_id: session.user.id
          },
          data: {
            draft_data: draftData,
            updated_at: new Date()
          }
        })
      }
    }

    const draft = await prisma.vettingDraft.findFirst({
      where: {
        claim_id: params.id,
        stage,
        saved_by_id: session.user.id
      }
    })

    return NextResponse.json({
      success: true,
      draft: draft
    })
  } catch (error) {
    console.error("Error saving draft:", error)
    return NextResponse.json(
      { error: "Failed to save draft" },
      { status: 500 }
    )
  }
}

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

    // Get draft
    const draft = await prisma.vettingDraft.findFirst({
      where: {
        claim_id: params.id,
        stage: stage,
        saved_by_id: session.user.id
      }
    })

    return NextResponse.json({
      success: true,
      draft: draft
    })
  } catch (error) {
    console.error("Error fetching draft:", error)
    return NextResponse.json(
      { error: "Failed to fetch draft" },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Delete draft
    await prisma.vettingDraft.deleteMany({
      where: {
        claim_id: params.id,
        stage: stage,
        saved_by_id: session.user.id
      }
    })

    return NextResponse.json({
      success: true,
      message: "Draft deleted"
    })
  } catch (error) {
    console.error("Error deleting draft:", error)
    return NextResponse.json(
      { error: "Failed to delete draft" },
      { status: 500 }
    )
  }
}
