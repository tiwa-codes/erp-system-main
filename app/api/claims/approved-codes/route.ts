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

export async function GET(request: NextRequest) {
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
    const selectedVetterId = searchParams.get("vetter_id") || ""
    const completedAtRange = getDateRange(searchParams)

    const [vettingRecords, vettingActions, timelineRecords] = await Promise.all([
      prisma.vettingRecord.findMany({
        where: {
          status: "COMPLETED",
          ...(selectedVetterId ? { vetter_id: selectedVetterId } : {}),
          ...(completedAtRange ? { completed_at: completedAtRange } : {}),
        },
        select: {
          claim_id: true,
          vetter_id: true,
          completed_at: true,
        },
      }),
      prisma.vettingAction.findMany({
        where: {
          stage: "vetter1",
          action: { in: ["APPROVED", "REJECTED", "REJECTED_BACK"] },
          ...(selectedVetterId ? { action_by_id: selectedVetterId } : {}),
          ...(completedAtRange ? { created_at: completedAtRange } : {}),
        },
        select: {
          claim_id: true,
          action_by_id: true,
          created_at: true,
        },
      }),
      prisma.approvalCodeTimeline.findMany({
        where: {
          stage: { in: ["VETTER1_COMPLETED", "VETTER2_COMPLETED", "AUDIT_COMPLETED", "MD_APPROVED"] },
          user_id: selectedVetterId || undefined,
          ...(completedAtRange ? { timestamp: completedAtRange } : {}),
          approval_code: {
            is_deleted: false,
            claim_id: { not: null },
          },
        },
        select: {
          approval_code: {
            select: {
              claim_id: true,
            },
          },
          user_id: true,
          timestamp: true,
        },
      }),
    ])

    const normalized = [
      ...vettingRecords.map((record) => ({
        claim_id: record.claim_id,
        vetter_id: record.vetter_id,
        vetted_at: record.completed_at,
      })),
      ...vettingActions.map((record) => ({
        claim_id: record.claim_id,
        vetter_id: record.action_by_id,
        vetted_at: record.created_at,
      })),
      ...timelineRecords
        .filter((record) => record.approval_code.claim_id && record.user_id)
        .map((record) => ({
          claim_id: record.approval_code.claim_id as string,
          vetter_id: record.user_id as string,
          vetted_at: record.timestamp,
        })),
    ]

    const dedupMap = new Map<string, { claim_id: string; vetter_id: string; vetted_at: Date | null }>()
    for (const record of normalized) {
      const key = `${record.claim_id}:${record.vetter_id}`
      const existing = dedupMap.get(key)
      if (!existing || (record.vetted_at && (!existing.vetted_at || record.vetted_at > existing.vetted_at))) {
        dedupMap.set(key, record)
      }
    }

    const records = Array.from(dedupMap.values())
    const vetterIds = Array.from(new Set(records.map((r) => r.vetter_id)))
    const vetterUsers = await prisma.user.findMany({
      where: { id: { in: vetterIds } },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
      },
    })
    const vetterMap = new Map(
      vetterUsers.map((u) => [
        u.id,
        {
          name: `${u.first_name} ${u.last_name}`.trim() || "Unknown",
          email: u.email || null,
        },
      ])
    )

    const grouped = new Map<
      string,
      {
        vetter_id: string
        name: string
        email: string | null
        claimIds: Set<string>
      }
    >()

    for (const record of records) {
      const vetterId = record.vetter_id
      const current = grouped.get(vetterId) || {
        vetter_id: vetterId,
        name: vetterMap.get(vetterId)?.name || "Unknown",
        email: vetterMap.get(vetterId)?.email || null,
        claimIds: new Set<string>(),
      }
      current.claimIds.add(record.claim_id)
      grouped.set(vetterId, current)
    }

    const rows = Array.from(grouped.values())
      .map((item) => ({
        vetter_id: item.vetter_id,
        name: item.name,
        email: item.email,
        vetted_claims_count: item.claimIds.size,
      }))
      .sort((a, b) => b.vetted_claims_count - a.vetted_claims_count || a.name.localeCompare(b.name))
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }))

    const vetters = Array.from(
      new Map(
        records.map((record) => [
          record.vetter_id,
          {
            id: record.vetter_id,
            name: vetterMap.get(record.vetter_id)?.name || "Unknown",
          },
        ])
      ).values()
    ).sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      rows,
      vetters,
      total_vetted_claims: rows.reduce((sum, item) => sum + item.vetted_claims_count, 0),
    })
  } catch (error) {
    console.error("Error fetching approved codes summary:", error)
    return NextResponse.json(
      { error: "Failed to fetch approved codes summary" },
      { status: 500 }
    )
  }
}
