import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { ClaimStatus } from "@prisma/client"
import { z } from "zod"

const submitVettingSchema = z.object({
  outcome: z.enum(["APPROVED", "REJECTED", "FLAGGED", "PENDING_MORE_INFO"]),
  comments: z.string().optional(),
  services: z.array(z.object({
    id: z.string(),
    service_name: z.string(),
    claimed_band: z.string().optional(),  // Make optional
    allowed_band: z.string().optional(),  // Make optional  
    verdict: z.enum(["COVERED", "NOT_COVERED"]).optional(),  // Make optional
    claimed_amount: z.number(),
    tariff_amount: z.number(),
    price_verdict: z.enum(["MATCH", "ABOVE_TARIFF", "BELOW_TARIFF"])
  })).optional()
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

    // Check permission
    const hasPermission = await checkPermission(session.user.role as any, "claims", "vet")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const claimId = params.id
    const body = await request.json()
    const validatedData = submitVettingSchema.parse(body)

    // Get user details for audit trail
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, first_name: true, last_name: true, email: true }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get current claim to determine workflow stage
    const currentClaim = await prisma.claim.findUnique({
      where: { id: claimId },
      select: { status: true }
    })

    if (!currentClaim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 })
    }

    // Update claim status based on vetting outcome and current stage
    let newStatus: ClaimStatus = currentClaim.status
    
    if (validatedData.outcome === "REJECTED") {
      newStatus = ClaimStatus.REJECTED
    } else if (validatedData.outcome === "FLAGGED") {
      newStatus = ClaimStatus.VETTING
    } else if (validatedData.outcome === "PENDING_MORE_INFO") {
      newStatus = ClaimStatus.UNDER_REVIEW
    } else if (validatedData.outcome === "APPROVED") {
      // Workflow progression based on current status
      if (currentClaim.status === ClaimStatus.VETTING) {
        newStatus = ClaimStatus.VETTER1_COMPLETED
      } else if (currentClaim.status === ClaimStatus.VETTER1_COMPLETED) {
        newStatus = ClaimStatus.VETTER2_COMPLETED
      } else if (currentClaim.status === ClaimStatus.VETTER2_COMPLETED) {
        newStatus = ClaimStatus.AUDIT_COMPLETED
      } else if (currentClaim.status === ClaimStatus.AUDIT_COMPLETED) {
        newStatus = ClaimStatus.APPROVED
      }
    }

    // Update the claim
    const updatedClaim = await prisma.claim.update({
      where: { id: claimId },
      data: {
        status: newStatus,
        processed_at: new Date()
      }
    })

    // Create vetting record
    const vettingRecord = await prisma.vettingRecord.create({
      data: {
        claim_id: claimId,
        vetter_id: user.id,
        vetting_type: "MANUAL",
        status: "COMPLETED", // Always COMPLETED for vetting records
        findings: validatedData.comments || "",
        recommendations: validatedData.outcome,
        completed_at: new Date()
      }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: "VET_CLAIM",
        resource: "CLAIM",
        resource_id: claimId,
        new_values: {
          vetting_outcome: validatedData.outcome,
          comments: validatedData.comments,
          services_reviewed: validatedData.services?.length || 0
        },
        ip_address: request.headers.get("x-forwarded-for") || "unknown",
        user_agent: request.headers.get("user-agent") || "unknown"
      }
    })

    return NextResponse.json({
      success: true,
      claim: updatedClaim,
      vetting_record: vettingRecord
    })
  } catch (error) {
    console.error("Error submitting vetting:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to submit vetting" },
      { status: 500 }
    )
  }
}
