import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        role: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user has vetting permissions based on role
    const hasVetPermission = [
      'SUPER_ADMIN',
      'ADMIN', 
      'CLAIMS_PROCESSOR',
      'CLAIMS_MANAGER'
    ].includes(user.role?.name || '')

    if (!hasVetPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    // 'auto' = provider-originated, 'manual' = call-centre manual codes, '' = all
    const billType = searchParams.get("bill_type") || ""

    // Build the additional where clause fragment for bill type
    const billTypeWhere: any = { current_stage: "vetter1" }
    if (billType === "manual") {
      billTypeWhere.approval_codes = { some: { is_manual: true, is_deleted: false } }
    } else if (billType === "auto") {
      billTypeWhere.NOT = { approval_codes: { some: { is_manual: true, is_deleted: false } } }
    }

    // Get vetter1 metrics
    const [
      totalVetted,
      pendingVetting,
      flaggedClaims,
      totalAmount,
      approvedAmount,
      rejectedAmount
    ] = await Promise.all([
      // Total claims at vetter1 stage
      prisma.claim.count({
        where: {
          ...billTypeWhere,
          status: {
            in: ["NEW", "PENDING", "SUBMITTED", "UNDER_REVIEW", "VETTING", "VETTER1_COMPLETED", "VETTER2_COMPLETED", "AUDIT_COMPLETED", "APPROVED", "REJECTED", "PAID"]
          }
        }
      }),
      // Pending vetting (submitted / under review / vetting — not yet processed)
      prisma.claim.count({
        where: {
          ...billTypeWhere,
          status: { in: ["NEW", "PENDING", "SUBMITTED", "UNDER_REVIEW", "VETTING"] }
        }
      }),
      // Flagged claims (rejected)
      prisma.claim.count({
        where: {
          ...billTypeWhere,
          status: "REJECTED"
        }
      }),
      // Total amount
      prisma.claim.aggregate({
        where: {
          ...billTypeWhere,
          status: {
            in: ["NEW", "PENDING", "SUBMITTED", "UNDER_REVIEW", "VETTING", "VETTER1_COMPLETED", "VETTER2_COMPLETED", "AUDIT_COMPLETED", "APPROVED", "REJECTED", "PAID"]
          }
        },
        _sum: { amount: true }
      }),
      // Approved amount
      prisma.claim.aggregate({
        where: {
          ...billTypeWhere,
          status: "APPROVED"
        },
        _sum: { amount: true }
      }),
      // Rejected amount
      prisma.claim.aggregate({
        where: {
          ...billTypeWhere,
          status: "REJECTED"
        },
        _sum: { amount: true }
      })
    ])

    const totalAmountValue = Number(totalAmount._sum.amount || 0)
    const approvedAmountValue = Number(approvedAmount._sum.amount || 0)
    const rejectedAmountValue = Number(rejectedAmount._sum.amount || 0)
    const netAmount = totalAmountValue - rejectedAmountValue

    // Calculate average vetting time (mock data for now)
    const avgVettingTime = 2.5 // hours

    const metrics = {
      total_audited: totalVetted,
      pending_audit: pendingVetting,
      flagged_claims: flaggedClaims,
      avg_audit_time: avgVettingTime,
      total_amount: totalAmountValue,
      approved_amount: approvedAmountValue,
      rejected_amount: rejectedAmountValue,
      net_amount: netAmount
    }

    return NextResponse.json({
      success: true,
      metrics
    })

  } catch (error) {
    console.error("Error fetching vetter1 metrics:", error)
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    )
  }
}
