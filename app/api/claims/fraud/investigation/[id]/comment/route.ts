import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const commentSchema = z.object({
  comment: z.string().min(1, "Comment is required")
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canAccess = await checkPermission(session.user.role as any, 'claims', 'fraud_detection')
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const claimId = params.id
    const body = await request.json()
    const { comment } = commentSchema.parse(body)

    // Create audit log entry for the comment
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'INVESTIGATION_COMMENT',
        resource: 'Claim',
        resource_id: claimId,
        new_values: { comment: comment },
        created_at: new Date()
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding comment:', error)
    return NextResponse.json(
      { error: 'Failed to add comment' },
      { status: 500 }
    )
  }
}
