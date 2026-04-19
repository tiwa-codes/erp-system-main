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

    // Check if code is already used
    if (approvalCodeRecord.status === 'USED') {
      return NextResponse.json({ 
        error: "This approval code has already been used and cannot be used again" 
      }, { status: 400 })
    }

    // Mark the code as used when verified
    const updatedApprovalCode = await prisma.approvalCode.update({
      where: { id: approvalCodeRecord.id },
      data: { 
        status: 'USED',
        updated_at: new Date()
      }
    })

    const approvalDetails = {
      enrollee: approvalCodeRecord.enrollee ? 
        `${approvalCodeRecord.enrollee.first_name} ${approvalCodeRecord.enrollee.last_name} (${approvalCodeRecord.enrollee.enrollee_id})` :
        approvalCodeRecord.enrollee_name,
      provider: approvalCodeRecord.hospital,
      service: approvalCodeRecord.services,
      date: approvalCodeRecord.created_at.toISOString().split('T')[0],
      linked_claim: '-', // No claim relation exists
      status: 'USED' // Code is now marked as used
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "APPROVAL_CODE_VERIFY_AND_MARK_USED",
        resource: "approval_code",
        resource_id: approvalCodeRecord.id,
        old_values: { status: approvalCodeRecord.status },
        new_values: { 
          status: 'USED',
          verification_result: approvalDetails 
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
