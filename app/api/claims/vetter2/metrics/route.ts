import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [canViewClaims, canVetClaims] = await Promise.all([
      checkPermission(session.user.role as any, "claims", "view"),
      checkPermission(session.user.role as any, "claims", "vet")
    ])

    if (!canViewClaims && !canVetClaims) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const billType = searchParams.get("bill_type") || ""

    const billTypeWhere: any = { current_stage: "vetter2" }
    if (billType === "manual") {
      billTypeWhere.approval_codes = { some: { is_manual: true, is_deleted: false } }
    } else if (billType === "auto") {
      billTypeWhere.NOT = { approval_codes: { some: { is_manual: true, is_deleted: false } } }
    }

    // Get vetter2 metrics - claims that have been vetted by vetter1
    const [
      totalVetted,
      pendingVetting,
      flaggedClaims,
      totalAmount,
      approvedAmount,
      rejectedAmount
    ] = await Promise.all([
      // Total claims vetted by vetter2 (claims that have been through vetter1)
      prisma.claim.count({
        where: {
          ...billTypeWhere,
          status: {
            in: ["VETTING", "APPROVED", "REJECTED", "PAID"]
          }
        }
      }),
      // Pending vetter2 review (claims vetted by vetter1 but not yet by vetter2)
      prisma.claim.count({
        where: {
          ...billTypeWhere,
          status: "VETTING",
        }
      }),
      // Flagged claims (rejected by vetter2)
      prisma.claim.count({
        where: {
          ...billTypeWhere,
          status: "REJECTED",
        }
      }),
      // Total amount for vetter2 claims
      prisma.claim.aggregate({
        where: {
          ...billTypeWhere,
          status: {
            in: ["VETTING", "APPROVED", "REJECTED", "PAID"]
          }
        },
        _sum: {
          amount: true
        }
      }),
      // Approved amount by vetter2
      prisma.claim.aggregate({
        where: {
          ...billTypeWhere,
          status: "APPROVED",
        },
        _sum: {
          amount: true
        }
      }),
      // Rejected amount by vetter2
      prisma.claim.aggregate({
        where: {
          ...billTypeWhere,
          status: "REJECTED",
        },
        _sum: {
          amount: true
        }
      })
    ])

    const totalAmountValue = Number(totalAmount._sum?.amount || 0)
    const approvedAmountValue = Number(approvedAmount._sum?.amount || 0)
    const rejectedAmountValue = Number(rejectedAmount._sum?.amount || 0)
    const netAmount = Number(totalAmountValue) - Number(rejectedAmountValue)

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
    console.error("Error fetching vetter2 metrics:", error)
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    )
  }
}
