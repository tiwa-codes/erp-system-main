import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has call-centre permissions
    const hasPermission = await checkPermission(session.user.role as any, "call-centre", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const approvalCode = params.code

    // Find approval code
    const approvalCodeRecord = await prisma.approvalCode.findFirst({
      where: { approval_code: approvalCode },
      include: {
        enrollee: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true
          }
        },
        generated_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true
          }
        }
      }
    })

    if (!approvalCodeRecord) {
      return NextResponse.json({ error: "Approval code does not exist" }, { status: 404 })
    }

    // Block access to soft-deleted codes
    if (approvalCodeRecord.is_deleted) {
      return NextResponse.json({ error: "Approval code does not exist" }, { status: 404 })
    }

    // Get claim information if linked
    let claimInfo = "No claim linked"
    if (approvalCodeRecord.claim_id) {
      const claim = await prisma.claim.findUnique({
        where: { id: approvalCodeRecord.claim_id },
        select: {
          claim_number: true,
          status: true
        }
      })
      if (claim) {
        claimInfo = `${claim.claim_number} (${claim.status})`
      }
    }

    // Build approval details response
    const approvalDetails = {
      approval_code: approvalCodeRecord.approval_code,
      enrollee: approvalCodeRecord.enrollee ? 
        `${approvalCodeRecord.enrollee.first_name} ${approvalCodeRecord.enrollee.last_name} (${approvalCodeRecord.enrollee.enrollee_id})` :
        approvalCodeRecord.enrollee_name,
      provider: approvalCodeRecord.hospital,
      service: approvalCodeRecord.services,
      diagnosis: approvalCodeRecord.diagnosis || "Not specified",
      amount: approvalCodeRecord.amount.toString(),
      admission_required: approvalCodeRecord.admission_required,
      date: approvalCodeRecord.created_at.toISOString().split('T')[0],
      generated_by: approvalCodeRecord.generated_by ?
        `${approvalCodeRecord.generated_by.first_name} ${approvalCodeRecord.generated_by.last_name}` :
        "Unknown",
      linked_claim: claimInfo,
      status: approvalCodeRecord.status
    }

    // Create audit log for verification
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "APPROVAL_CODE_VERIFY",
        resource: "approval_code",
        resource_id: approvalCodeRecord.id,
        new_values: { 
          verification_result: approvalDetails,
          verified_at: new Date()
        }
      }
    })

    return NextResponse.json({
      success: true,
      approval_details: approvalDetails
    })

  } catch (error) {
    console.error("Error verifying approval code:", error)
    return NextResponse.json(
      { error: "Failed to verify approval code" },
      { status: 500 }
    )
  }
}
