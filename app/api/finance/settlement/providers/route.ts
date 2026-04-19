import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

type GroupedProvider = {
  provider_id: string
  provider_name: string
  provider_code: string
  total_enrollees: number
  total_amount: number
  paid_amount: number
  pending_claims: number
}

const mapPayoutStatus = (payouts: { status: string }[]) => {
  if (!payouts || payouts.length === 0) return "PENDING"
  const status = payouts[0].status
  if (status === "PAID") return "PAID"
  if (status === "PROCESSED") return "PROCESSING"
  if (status === "FAILED") return "FAILED"
  return "PENDING"
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canAccess = await checkPermission(session.user.role as any, "finance", "view")
    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || "all"
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")

    const whereClause: any = {
      status: { in: ["APPROVED", "PAID"] }
    }

    if (startDate && endDate) {
      whereClause.submitted_at = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    const claims = await prisma.claim.findMany({
      where: whereClause,
      select: {
        id: true,
        amount: true,
        provider_id: true,
        principal_id: true,
        provider: {
          select: {
            id: true,
            facility_name: true,
            hcp_code: true
          }
        },
        payouts: {
          select: { status: true }
        }
      }
    })

    const providerMap = new Map<string, GroupedProvider & { enrollee_ids: Set<string> }>()

    claims.forEach((claim) => {
      const payoutStatus = mapPayoutStatus(claim.payouts)
      if (status !== "all" && payoutStatus !== status) {
        return
      }

      const providerId = claim.provider_id || "unknown"
      const providerName = claim.provider?.facility_name || "Unknown Provider"
      const providerCode = claim.provider?.hcp_code || ""

      if (!providerMap.has(providerId)) {
      providerMap.set(providerId, {
        provider_id: providerId,
        provider_name: providerName,
        provider_code: providerCode,
        total_enrollees: 0,
        total_amount: 0,
        paid_amount: 0,
        pending_claims: 0,
        enrollee_ids: new Set<string>()
      })
      }

      const group = providerMap.get(providerId)
      if (!group) return

      group.total_amount += Number(claim.amount || 0)
      if (payoutStatus === "PAID") {
        group.paid_amount += Number(claim.amount || 0)
      } else {
        group.pending_claims += 1
      }

      if (claim.principal_id) {
        group.enrollee_ids.add(claim.principal_id)
      }
    })

    let groups = Array.from(providerMap.values()).map((group) => ({
      provider_id: group.provider_id,
      provider_name: group.provider_name,
      provider_code: group.provider_code,
      total_enrollees: group.enrollee_ids.size,
      total_amount: group.total_amount,
      paid_amount: group.paid_amount,
      pending_claims: group.pending_claims
    }))

    if (search) {
      const term = search.toLowerCase()
      groups = groups.filter((group) => group.provider_name.toLowerCase().includes(term))
    }

    const total = groups.length
    const start = (page - 1) * limit
    const paginated = groups.slice(start, start + limit)

    return NextResponse.json({
      providers: paginated,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching settlement providers:", error)
    return NextResponse.json(
      { error: "Failed to fetch settlement providers" },
      { status: 500 }
    )
  }
}
