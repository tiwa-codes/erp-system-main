import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

const mapPayoutStatus = (payouts: { status: string }[]) => {
  if (!payouts || payouts.length === 0) return "PENDING"
  const status = payouts[0].status
  if (status === "PAID") return "PAID"
  if (status === "PROCESSED") return "PROCESSING"
  if (status === "FAILED") return "FAILED"
  return "PENDING"
}

export async function GET(
  request: NextRequest,
  { params }: { params: { providerId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canAccess = await checkPermission(session.user.role as any, "finance", "view")
    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const providerId = params.providerId
    const whereClause: any = {
      status: { in: ["APPROVED", "PAID"] }
    }

    if (providerId === "unknown") {
      whereClause.provider_id = null
    } else {
      whereClause.provider_id = providerId
    }

    const claims = await prisma.claim.findMany({
      where: whereClause,
      select: {
        id: true,
        claim_number: true,
        enrollee_id: true,
        amount: true,
        submitted_at: true,
        principal: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true
          }
        },
        provider: {
          select: {
            id: true,
            facility_name: true,
            hcp_code: true
          }
        },
        payouts: {
          select: { status: true }
        },
        approval_codes: {
          select: {
            beneficiary_id: true,
            enrollee_name: true,
            created_at: true
          },
          orderBy: {
            created_at: "desc"
          },
          take: 1
        }
      },
      orderBy: { submitted_at: "desc" }
    })

    const beneficiaryIds = Array.from(
      new Set(
        claims
          .map((claim) => claim.approval_codes?.[0]?.beneficiary_id)
          .filter((id): id is string => Boolean(id))
      )
    )

    const dependents = beneficiaryIds.length
      ? await prisma.dependent.findMany({
          where: {
            dependent_id: { in: beneficiaryIds }
          },
          select: {
            dependent_id: true,
            first_name: true,
            last_name: true
          }
        })
      : []

    const dependentMap = new Map(dependents.map((dependent) => [dependent.dependent_id, dependent]))

    const enrolleeMap = new Map<string, any>()

    claims.forEach((claim) => {
      const approvalCode = claim.approval_codes?.[0]
      const beneficiaryId = approvalCode?.beneficiary_id || null
      const principalEnrolleeId = claim.principal?.enrollee_id || null
      const isDependentClaim = Boolean(beneficiaryId && principalEnrolleeId && beneficiaryId !== principalEnrolleeId)

      const dependent = beneficiaryId ? dependentMap.get(beneficiaryId) : undefined

      const displayEnrolleeId = isDependentClaim
        ? beneficiaryId
        : (principalEnrolleeId || claim.enrollee_id)

      let displayEnrolleeName = claim.principal
        ? `${claim.principal.first_name} ${claim.principal.last_name}`
        : "Unknown Enrollee"

      if (isDependentClaim) {
        if (dependent) {
          displayEnrolleeName = `${dependent.first_name} ${dependent.last_name}`
        } else if (approvalCode?.enrollee_name?.trim()) {
          displayEnrolleeName = approvalCode.enrollee_name.trim()
        }
      }

      const enrolleeKey = isDependentClaim
        ? `dependent:${displayEnrolleeId || claim.id}`
        : (claim.principal?.id ? `principal:${claim.principal.id}` : `claim:${claim.id}`)

      if (!enrolleeMap.has(enrolleeKey)) {
        enrolleeMap.set(enrolleeKey, {
          enrollee_id: displayEnrolleeId || "N/A",
          enrollee_name: displayEnrolleeName,
          total_amount: 0,
          paid_amount: 0,
          claims: [] as any[]
        })
      }

      const enrollee = enrolleeMap.get(enrolleeKey)
      const payoutStatus = mapPayoutStatus(claim.payouts)
      const amount = Number(claim.amount || 0)

      enrollee.total_amount += amount
      if (payoutStatus === "PAID") {
        enrollee.paid_amount += amount
      }

      enrollee.claims.push({
        id: claim.id,
        claim_number: claim.claim_number,
        amount,
        payout_status: payoutStatus,
        submitted_at: claim.submitted_at
      })
    })

    const providerName = claims[0]?.provider?.facility_name || "Unknown Provider"
    const providerCode = claims[0]?.provider?.hcp_code || ""

    return NextResponse.json({
      provider: {
        id: providerId,
        name: providerName,
        code: providerCode
      },
      enrollees: Array.from(enrolleeMap.values())
    })
  } catch (error) {
    console.error("Error fetching provider enrollees:", error)
    return NextResponse.json(
      { error: "Failed to fetch provider enrollees" },
      { status: 500 }
    )
  }
}
