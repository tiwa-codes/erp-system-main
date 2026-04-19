import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const editPriceSchema = z.object({
  newAmount: z.number().positive(),
  reason: z.string().min(1, "Reason is required"),
  stage: z.enum(['vetter1', 'vetter2', 'audit', 'approval'])
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has permission to edit prices
    const userRole = session.user.role as string
    const canEditPrice = ['ADMIN', 'SUPER_ADMIN', 'CLAIMS_PROCESSOR'].includes(userRole)
    
    if (!canEditPrice) {
      return NextResponse.json(
        { error: "Only Claims Processors, Auditors, and Admins can edit prices" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = editPriceSchema.parse(body)
    const { newAmount, reason, stage } = validatedData

    // Get claim
    const claim = await prisma.claim.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        claim_number: true,
        amount: true,
        original_amount: true,
        current_stage: true
      }
    })

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 })
    }

    // Check if claim is at the correct stage
    if (claim.current_stage !== stage) {
      return NextResponse.json(
        { error: `Claim is not at ${stage} stage` },
        { status: 400 }
      )
    }

    // Update claim price
    const result = await prisma.$transaction(async (tx) => {
      // Create price edit record
      const priceEdit = await tx.priceEdit.create({
        data: {
          claim_id: params.id,
          old_amount: claim.amount,
          new_amount: newAmount,
          edited_by_id: session.user.id,
          stage: stage,
          reason: reason
        }
      })

      // Update claim amount (and set original_amount on first edit)
      await tx.claim.update({
        where: { id: params.id },
        data: {
          amount: newAmount,
          // Freeze original_amount the very first time a price edit is made
          ...(claim.original_amount == null ? { original_amount: claim.amount } : {})
        }
      })

      return priceEdit
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'CLAIM_PRICE_EDITED',
        resource: 'claim',
        resource_id: params.id,
        old_values: {
          amount: claim.amount
        },
        new_values: {
          amount: newAmount,
          reason: reason,
          stage: stage
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: "Price updated successfully",
      priceEdit: result
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error editing price:", error)
    return NextResponse.json(
      { error: "Failed to edit price" },
      { status: 500 }
    )
  }
}









