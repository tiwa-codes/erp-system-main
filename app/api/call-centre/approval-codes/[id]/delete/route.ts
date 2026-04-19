import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission
    const hasPermission = await checkPermission(session.user.role as any, "call-centre", "delete")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { reason } = body

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: "Deletion reason is required" },
        { status: 400 }
      )
    }

    // Find the approval code
    const approvalCode = await prisma.approvalCode.findUnique({
      where: { id },
    })

    if (!approvalCode) {
      return NextResponse.json(
        { error: "Approval code not found" },
        { status: 404 }
      )
    }

    if (approvalCode.is_deleted) {
      return NextResponse.json(
        { error: "Approval code is already deleted" },
        { status: 400 }
      )
    }

    // Soft delete the approval code
    const updatedCode = await prisma.approvalCode.update({
      where: { id },
      data: {
        is_deleted: true,
        deleted_at: new Date(),
        deleted_by_id: session.user.id,
        deletion_reason: reason.trim(),
      },
    })

    // Find and update the linked ProviderRequest status to DELETED to remove from active lists
    if (approvalCode.claim_id) {
      try {
        await prisma.providerRequest.updateMany({
          where: { claim_id: approvalCode.claim_id },
          data: { status: 'DELETED' as any },
        })
      } catch (reqError) {
        console.error("Error syncing ProviderRequest status on deletion:", reqError)
      }
    } else {
      // Fallback: match by enrollee and hospital if no claim_id is present
      try {
        await prisma.providerRequest.updateMany({
          where: {
            enrollee_id: approvalCode.enrollee_id,
            hospital: approvalCode.hospital,
            status: { not: 'DELETED' as any }
          },
          data: { status: 'DELETED' as any },
        })
      } catch (reqError) {
        console.error("Error syncing ProviderRequest status (fallback) on deletion:", reqError)
      }
    }

    // Create timeline entry for audit trail
    await prisma.approvalCodeTimeline.create({
      data: {
        approval_code_id: id,
        stage: "DELETED",
        user_id: session.user.id,
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "DELETE",
        resource: "approval_code",
        resource_id: id,
        old_values: {
          status: approvalCode.status,
          is_deleted: false,
        },
        new_values: {
          is_deleted: true,
          deletion_reason: reason.trim(),
          deleted_at: new Date().toISOString(),
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: "Approval code deleted successfully",
      approval_code: {
        id: updatedCode.id,
        approval_code: updatedCode.approval_code,
        is_deleted: updatedCode.is_deleted,
        deleted_at: updatedCode.deleted_at,
        deletion_reason: updatedCode.deletion_reason,
      },
    })
  } catch (error) {
    console.error("Error deleting approval code:", error)
    return NextResponse.json(
      { error: "Failed to delete approval code" },
      { status: 500 }
    )
  }
}
