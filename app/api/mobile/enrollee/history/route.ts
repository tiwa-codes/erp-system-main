/**
 * GET /api/mobile/enrollee/history
 * Returns a unified, date-sorted list of visit/encounter records for the enrollee.
 * Sources:
 *   1. TelemedicineAppointments   → type "TELEMEDICINE"
 *   2. ApprovalCodes (in-person)  → type "APPROVAL_CODE"
 *
 * Query params:
 *   filter  – "all" | "visits" | "prescriptions" | "services"   (default: "all")
 *   from    – ISO date string  (optional)
 *   to      – ISO date string  (optional)
 *   page    – number           (default: 1)
 *   limit   – number           (default: 20)
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileToken } from "@/lib/mobile-auth"
import { trackStatisticsEvent } from "@/lib/statistics-events"

export async function GET(req: NextRequest) {
  try {
    const session = await verifyMobileToken(req)
    if (!session || session.role !== "ENROLLEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const principal = await prisma.principalAccount.findUnique({
      where: { id: session.id },
      select: { id: true },
    })

    if (!principal) {
      return NextResponse.json({ error: "Enrollee not found" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const filter = searchParams.get("filter") ?? "all"
    const fromStr = searchParams.get("from")
    const toStr = searchParams.get("to")
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
    const limit = Math.max(1, Math.min(50, parseInt(searchParams.get("limit") ?? "20")))

    const fromDate = fromStr ? new Date(fromStr) : undefined
    const toDate = toStr ? new Date(toStr + "T23:59:59.999Z") : undefined

    // ── 1. Telemedicine appointments ──────────────────────────────────────────
    const shouldFetchTele = filter === "all" || filter === "visits" || filter === "prescriptions"
    const shouldFetchCodes = filter === "all" || filter === "services"

    const [appointments, approvalCodes] = await Promise.all([
      shouldFetchTele
        ? prisma.telemedicineAppointment.findMany({
            where: {
              enrollee_id: principal.id,
              ...(fromDate || toDate
                ? {
                    scheduled_date: {
                      ...(fromDate ? { gte: fromDate } : {}),
                      ...(toDate ? { lte: toDate } : {}),
                    },
                  }
                : {}),
            },
            include: {
              provider: { select: { facility_name: true } },
              lab_orders: {
                include: { facility: { select: { facility_name: true } } },
              },
              radiology_orders: {
                include: { facility: { select: { facility_name: true } } },
              },
              pharmacy_orders: {
                include: { facility: { select: { facility_name: true } } },
              },
              clinical_encounters: {
                select: {
                  id: true,
                  diagnosis: true,
                  presenting_complaints: true,
                  created_at: true,
                },
                take: 1,
              },
            },
            orderBy: { scheduled_date: "desc" },
          })
        : Promise.resolve([]),

      shouldFetchCodes
        ? prisma.approvalCode.findMany({
            where: {
              enrollee_id: principal.id,
              is_deleted: false,
              ...(fromDate || toDate
                ? {
                    created_at: {
                      ...(fromDate ? { gte: fromDate } : {}),
                      ...(toDate ? { lte: toDate } : {}),
                    },
                  }
                : {}),
            },
            include: {
              provider: { select: { facility_name: true } },
              service_items: {
                select: {
                  id: true,
                  service_name: true,
                  service_amount: true,
                  category: true,
                },
              },
            },
            orderBy: { created_at: "desc" },
          })
        : Promise.resolve([]),
    ])

    // ── 2. Map to unified HistoryRecord shape ─────────────────────────────────
    type Tag = "LAB" | "SCAN" | "MED" | "REFERRAL"

    interface HistoryRecord {
      id: string
      source: "TELEMEDICINE" | "APPROVAL_CODE"
      date: string
      facility_name: string
      reason: string
      tags: Tag[]
      status: string
      // telemedicine
      lab_orders?: Array<{
        id: string
        test_name: string
        findings?: string | null
        results?: string | null
        facility?: string | null
      }>
      radiology_orders?: Array<{
        id: string
        test_name: string
        pdf_report?: string | null
        facility?: string | null
      }>
      pharmacy_orders?: Array<{
        id: string
        medication: string
        dose?: string | null
        frequency?: string | null
        quantity?: number | null
        duration?: string | null
        facility?: string | null
      }>
      diagnosis?: string | null
      // approval code
      approval_code?: string
      services_summary?: string
      service_items?: Array<{
        id: string
        service_name: string
        amount?: number | null
        coverage?: string | null
      }>
      amount?: number | string | null
    }

    const teleRecords: HistoryRecord[] = appointments.map((appt) => {
      const tags: Tag[] = []
      if (appt.lab_orders.length > 0) tags.push("LAB")
      if (appt.radiology_orders.length > 0) tags.push("SCAN")
      if (appt.pharmacy_orders.length > 0) tags.push("MED")

      // Determine facility name: prefer linked provider, fall back to clinic or specialization
      const facilityName =
        appt.provider?.facility_name ??
        appt.clinic ??
        appt.specialization ??
        "Aspirage Telemedicine"

      // If filter === "prescriptions", only include if has pharmacy orders
      if (filter === "prescriptions" && appt.pharmacy_orders.length === 0) return null as any

      return {
        id: appt.id,
        source: "TELEMEDICINE",
        date: appt.scheduled_date.toISOString(),
        facility_name: facilityName,
        reason: appt.reason ?? appt.specialization ?? "Consultation",
        tags,
        status: appt.status,
        diagnosis: appt.clinical_encounters?.[0]?.diagnosis ?? null,
        lab_orders: appt.lab_orders.map((lo) => ({
          id: lo.id,
          test_name: lo.test_name,
          findings: lo.findings,
          results: lo.results,
          facility: (lo as any).facility?.facility_name ?? null,
        })),
        radiology_orders: appt.radiology_orders.map((ro) => ({
          id: ro.id,
          test_name: ro.test_name,
          pdf_report: ro.pdf_report,
          facility: (ro as any).facility?.facility_name ?? null,
        })),
        pharmacy_orders: appt.pharmacy_orders.map((po) => ({
          id: po.id,
          medication: po.medication,
          dose: po.dose,
          frequency: po.frequency,
          quantity: po.quantity,
          duration: po.duration,
          facility: (po as any).facility?.facility_name ?? null,
        })),
      }
    }).filter(Boolean)

    const codeRecords: HistoryRecord[] = approvalCodes.map((code) => ({
      id: code.id,
      source: "APPROVAL_CODE",
      date: code.created_at.toISOString(),
      facility_name: code.provider?.facility_name ?? code.hospital,
      reason: code.services ?? "In-person Visit",
      tags: [],
      status: code.status,
      approval_code: code.approval_code,
      services_summary: code.services,
      amount: Number(code.amount),
      service_items: code.service_items.map((si) => ({
        id: si.id,
        service_name: si.service_name,
        amount: si.service_amount ? Number(si.service_amount) : null,
        coverage: si.category ?? null,
      })),
    }))

    // ── 3. Merge, sort by date desc, paginate ─────────────────────────────────
    const all: HistoryRecord[] = [...teleRecords, ...codeRecords].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    const total = all.length
    const paginated = all.slice((page - 1) * limit, page * limit)

    await trackStatisticsEvent({
      event: "history_view",
      module: "enrolleeapp",
      stage: "history",
      outcome: "success",
      actorType: "enrollee",
      actorId: session.id,
      enrolleeId: session.enrollee_id || null,
      metadata: {
        filter,
        from: fromStr || null,
        to: toStr || null,
        total,
        page,
        limit,
      },
      req,
    })

    return NextResponse.json({
      records: paginated,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error("[MOBILE_HISTORY_GET]", error)
    await trackStatisticsEvent({
      event: "history_view",
      module: "enrolleeapp",
      stage: "history",
      outcome: "failed",
      actorType: "system",
      metadata: { reason: "server_error" },
      req,
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
