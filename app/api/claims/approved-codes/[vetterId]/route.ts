import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

function getDateRange(searchParams: URLSearchParams) {
  const startDate = searchParams.get("start_date")
  const endDate = searchParams.get("end_date")

  if (!startDate && !endDate) return undefined

  return {
    ...(startDate ? { gte: new Date(startDate) } : {}),
    ...(endDate ? { lte: new Date(`${endDate}T23:59:59.999Z`) } : {}),
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { vetterId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "claims", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const completedAtRange = getDateRange(searchParams)
    const { vetterId } = params

    const [vettingRecords, vettingActions, timelineRecords] = await Promise.all([
      prisma.vettingRecord.findMany({
        where: {
          vetter_id: vetterId,
          status: "COMPLETED",
          ...(completedAtRange ? { completed_at: completedAtRange } : {}),
        },
        select: {
          claim_id: true,
          completed_at: true,
        },
      }),
      prisma.vettingAction.findMany({
        where: {
          action_by_id: vetterId,
          stage: "vetter1",
          action: { in: ["APPROVED", "REJECTED", "REJECTED_BACK"] },
          ...(completedAtRange ? { created_at: completedAtRange } : {}),
        },
        select: {
          claim_id: true,
          created_at: true,
        },
      }),
      prisma.approvalCodeTimeline.findMany({
        where: {
          user_id: vetterId,
          stage: { in: ["VETTER1_COMPLETED", "VETTER2_COMPLETED", "AUDIT_COMPLETED", "MD_APPROVED"] },
          ...(completedAtRange ? { timestamp: completedAtRange } : {}),
          approval_code: {
            is_deleted: false,
            claim_id: { not: null },
          },
        },
        select: {
          approval_code: {
            select: { claim_id: true },
          },
          timestamp: true,
        },
      }),
    ])

    const normalized = [
      ...vettingRecords.map((record) => ({
        claim_id: record.claim_id,
        vetted_at: record.completed_at,
      })),
      ...vettingActions.map((record) => ({
        claim_id: record.claim_id,
        vetted_at: record.created_at,
      })),
      ...timelineRecords
        .filter((record) => record.approval_code.claim_id)
        .map((record) => ({
          claim_id: record.approval_code.claim_id as string,
          vetted_at: record.timestamp,
        })),
    ]

    const claimsById = new Map<string, { claim_id: string; vetted_at: Date | null }>()
    for (const record of normalized) {
      const existing = claimsById.get(record.claim_id)
      if (!existing || (record.vetted_at && (!existing.vetted_at || record.vetted_at > existing.vetted_at))) {
        claimsById.set(record.claim_id, record)
      }
    }

    const claimIds = Array.from(claimsById.keys())
    if (claimIds.length === 0) return NextResponse.json({ rows: [] })

    const claims = await prisma.claim.findMany({
      where: { id: { in: claimIds } },
      select: {
        id: true,
        claim_number: true,
        submitted_at: true,
        status: true,
        principal: {
          select: {
            first_name: true,
            last_name: true,
            enrollee_id: true,
          },
        },
        provider: {
          select: {
            facility_name: true,
          },
        },
        approval_codes: {
          where: { is_deleted: false },
          orderBy: { created_at: "desc" },
          select: {
            id: true,
            approval_code: true,
            created_at: true,
            service_items: {
              orderBy: { added_at: "asc" },
              select: {
                id: true,
                service_name: true,
                service_amount: true,
                quantity: true,
                category: true,
                vetted_amount: true,
                is_vetted_approved: true,
                rejection_reason: true,
                is_deleted: true,
              },
            },
          },
        },
      },
    })

    const missingClaimNumbers = claims
      .filter((claim) => claim.approval_codes.length === 0)
      .map((claim) => claim.claim_number)

    const fallbackCodes = missingClaimNumbers.length
      ? await prisma.approvalCode.findMany({
          where: {
            is_deleted: false,
            approval_code: { in: missingClaimNumbers },
          },
          orderBy: { created_at: "desc" },
          select: {
            id: true,
            approval_code: true,
            claim_id: true,
            created_at: true,
            service_items: {
              orderBy: { added_at: "asc" },
              select: {
                id: true,
                service_name: true,
                service_amount: true,
                quantity: true,
                category: true,
                vetted_amount: true,
                is_vetted_approved: true,
                rejection_reason: true,
                is_deleted: true,
              },
            },
          },
        })
      : []

    const fallbackCodeByApprovalCode = new Map(
      fallbackCodes.map((code) => [code.approval_code, code])
    )

    const rows = claims.map((claim) => {
      const record = claimsById.get(claim.id)
      const approvalCode = claim.approval_codes[0] || fallbackCodeByApprovalCode.get(claim.claim_number)
      const services = (approvalCode?.service_items || []).map((item) => ({
        id: item.id,
        service_name: item.service_name,
        quantity: item.quantity,
        amount: Number(item.service_amount || 0),
        vetted_amount: item.vetted_amount == null ? null : Number(item.vetted_amount),
        category: item.category,
        is_vetted_approved: item.is_vetted_approved,
        rejection_reason: item.rejection_reason,
        is_deleted: item.is_deleted,
      }))

      return {
        claim_id: claim.id,
        claim_number: claim.claim_number,
        approval_code: approvalCode?.approval_code || claim.claim_number,
        vetted_at: record?.vetted_at || claim.submitted_at,
        enrollee_name:
          `${claim.principal?.first_name || ""} ${claim.principal?.last_name || ""}`.trim() || "Unknown",
        enrollee_id: claim.principal?.enrollee_id || null,
        provider_name: claim.provider?.facility_name || "Unknown",
        claim_status: claim.status,
        services,
      }
    }).sort(
      (a, b) => new Date(b.vetted_at).getTime() - new Date(a.vetted_at).getTime()
    )

    return NextResponse.json({ rows })
  } catch (error) {
    console.error("Error fetching approved code details by vetter:", error)
    return NextResponse.json(
      { error: "Failed to fetch approved code details" },
      { status: 500 }
    )
  }
}
