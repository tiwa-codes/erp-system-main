import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { getEnrolleeUtilization } from "@/lib/underwriting/usage"

function parseServicesPayload(raw: string | null | undefined): any[] {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function normalizeServiceLabel(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "call-centre", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const enrolleeFilter = (searchParams.get("enrollee_id") || "").trim()
    const search = (searchParams.get("search") || "").trim()
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(50, Math.max(5, parseInt(searchParams.get("limit") || "20", 10)))
    const fetchLimit = page * limit

    // Keep history query inclusive. Hard-coded status lists caused regressions
    // when enum values diverged from historical/stateful data.
    const providerWhere: any = {}
    const approvalCodeWhere: any = {}

    let utilization = null
    const claimEnrolleeIds = new Set<string>() // string IDs used in Claim.enrollee_id

    if (enrolleeFilter) {
      const providerIdentifierClauses: any[] = []
      const approvalIdentifierClauses: any[] = []

      // 1. Try to find if this is a Principal Account (by UUID or Enrollee ID)
      let principal = await prisma.principalAccount.findFirst({
        where: {
          OR: [
            { id: enrolleeFilter },
            { enrollee_id: enrolleeFilter }
          ]
        },
        select: { id: true, enrollee_id: true }
      })
      let dependentMatch: { id?: string; dependent_id: string } | null = null

      // 2. If not found, try to find if this is a Dependent (by Dependent ID)
      if (!principal) {
        const dependent = await prisma.dependent.findFirst({
          where: {
            OR: [
              { id: enrolleeFilter },
              { dependent_id: enrolleeFilter }
            ]
          },
          select: { id: true, principal_id: true, dependent_id: true }
        })

        if (dependent) {
          dependentMatch = dependent
          principal = await prisma.principalAccount.findUnique({
            where: { id: dependent.principal_id },
            select: { id: true, enrollee_id: true }
          })
        }
      }

      if (principal) {
        if (dependentMatch?.dependent_id) {
          // Dependent context: only fetch records tied to this dependent.
          providerIdentifierClauses.push({ beneficiary_id: dependentMatch.dependent_id })
          approvalIdentifierClauses.push({ beneficiary_id: dependentMatch.dependent_id })
          claimEnrolleeIds.add(dependentMatch.dependent_id)
        } else {
          // Principal context: include only records where beneficiary resolves to the principal.
          // This prevents dependent encounters (same enrollee_id/principal_id) from appearing.
          const principalOnlyProviderFilter = {
            AND: [
              {
                OR: [
                  { enrollee_id: principal.id },
                  { enrollee_id: principal.enrollee_id }
                ]
              },
              {
                OR: [
                  { beneficiary_id: principal.enrollee_id },
                  { beneficiary_id: principal.id },
                  { beneficiary_id: null },
                  { beneficiary_id: "" }
                ]
              }
            ]
          }
          const principalOnlyApprovalFilter = {
            AND: [
              {
                OR: [
                  { enrollee_id: principal.id },
                  { enrollee_id: principal.enrollee_id }
                ]
              },
              {
                OR: [
                  { beneficiary_id: principal.enrollee_id },
                  { beneficiary_id: principal.id },
                  { beneficiary_id: null },
                  { beneficiary_id: "" }
                ]
              }
            ]
          }

          providerIdentifierClauses.push(principalOnlyProviderFilter)
          approvalIdentifierClauses.push(principalOnlyApprovalFilter)
          claimEnrolleeIds.add(principal.enrollee_id)
          claimEnrolleeIds.add(principal.id)
        }

        try {
          utilization = await getEnrolleeUtilization(principal.id)
        } catch (utilizationErr) {
          console.error('Failed to fetch utilization for encounter history:', utilizationErr)
          utilization = null
        }
      } else {
        // Fallback: try all common identifier fields.
        providerIdentifierClauses.push(
          { enrollee_id: enrolleeFilter },
          { beneficiary_id: enrolleeFilter }
        )
        approvalIdentifierClauses.push(
          { enrollee_id: enrolleeFilter },
          { beneficiary_id: enrolleeFilter }
        )
        claimEnrolleeIds.add(enrolleeFilter)
      }

      if (providerIdentifierClauses.length > 0) {
        providerWhere.AND = providerWhere.AND
          ? [...providerWhere.AND, { OR: providerIdentifierClauses }]
          : [{ OR: providerIdentifierClauses }]
      }
      if (approvalIdentifierClauses.length > 0) {
        approvalCodeWhere.AND = approvalCodeWhere.AND
          ? [...approvalCodeWhere.AND, { OR: approvalIdentifierClauses }]
          : [{ OR: approvalIdentifierClauses }]
      }
    }

    if (search) {
      const providerSearch = {
        OR: [
          { request_id: { startsWith: search, mode: "insensitive" } },
          { hospital: { startsWith: search, mode: "insensitive" } },
          {
            provider: {
              facility_name: { startsWith: search, mode: "insensitive" }
            }
          },
          {
            enrollee: {
              OR: [
                { enrollee_id: { startsWith: search, mode: "insensitive" } },
                { first_name: { startsWith: search, mode: "insensitive" } },
                { last_name: { startsWith: search, mode: "insensitive" } }
              ]
            }
          }
        ]
      }
      providerWhere.AND = providerWhere.AND ? [...providerWhere.AND, providerSearch] : [providerSearch]

      const approvalSearch = {
        OR: [
          { approval_code: { startsWith: search, mode: "insensitive" } },
          { hospital: { startsWith: search, mode: "insensitive" } },
          {
            enrollee: {
              OR: [
                { enrollee_id: { startsWith: search, mode: "insensitive" } },
                { first_name: { startsWith: search, mode: "insensitive" } },
                { last_name: { startsWith: search, mode: "insensitive" } }
              ]
            }
          },
          { beneficiary_id: { startsWith: search, mode: "insensitive" } }
        ]
      }
      approvalCodeWhere.AND = approvalCodeWhere.AND ? [...approvalCodeWhere.AND, approvalSearch] : [approvalSearch]
    }

    const [providerRequests, approvalCodes] = await Promise.all([
      prisma.providerRequest.findMany({
        where: providerWhere,
        include: {
          provider: {
            select: { facility_name: true }
          },
          enrollee: {
            select: { enrollee_id: true, first_name: true, last_name: true }
          },
          request_items: {
            select: {
              service_name: true,
              category: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
        take: fetchLimit
      }),
      prisma.approvalCode.findMany({
        where: approvalCodeWhere,
        include: {
          enrollee: {
            select: { enrollee_id: true, first_name: true, last_name: true }
          },
          provider: {
            select: { facility_name: true }
          },
          service_items: {
            select: { service_name: true, category: true, is_deleted: true },
            where: { is_deleted: false }
          }
        },
        orderBy: { created_at: "desc" },
        take: fetchLimit
      })
    ])

    // Fetch Claims separately (Claim.enrollee_id is a string ID, not UUID)
    let claimEncounters: any[] = []
    if (claimEnrolleeIds.size > 0) {
      const claimIds = Array.from(claimEnrolleeIds)
      const claimWhere: any = claimIds.length === 1
        ? { enrollee_id: claimIds[0] }
        : { enrollee_id: { in: claimIds } }
      if (search) {
        claimWhere.OR = [
          { claim_number: { startsWith: search, mode: "insensitive" } },
          { provider: { facility_name: { startsWith: search, mode: "insensitive" } } }
        ]
      }
      const claims = await prisma.claim.findMany({
        where: claimWhere,
        select: {
          id: true,
          enrollee_id: true,
          claim_number: true,
          amount: true,
          status: true,
          submitted_at: true,
          updated_at: true,
          provider: { select: { facility_name: true } },
          approval_codes: {
            take: 1,
            orderBy: { updated_at: "desc" },
            select: {
              approval_code: true,
              diagnosis: true,
              is_deleted: true,
              service_items: {
                select: { service_name: true, category: true, is_deleted: true },
                where: { is_deleted: false }
              }
            }
          }
        },
        orderBy: { submitted_at: "desc" },
        take: fetchLimit
      })
      claimEncounters = claims.map((claim) => {
        const approval = claim.approval_codes?.[0]
        const serviceItems = (approval?.service_items || []).map(s => ({ service_name: s.service_name, category: s.category }))
        const isCodeDeleted = Boolean(approval?.is_deleted)
        return {
          id: claim.id,
          claim_id: claim.id,
          approval_code: approval?.approval_code || claim.claim_number,
          hospital: claim.provider?.facility_name || "Unknown Provider",
          provider_name: claim.provider?.facility_name || "",
          enrollee_name: "",
          enrollee_id: claim.enrollee_id,
          diagnosis: approval?.diagnosis || "",
          services: serviceItems,   // array — modal's parseServices handles this
          amount: Number(claim.amount || 0),
          status: isCodeDeleted ? "DELETED" : claim.status,
          created_at: claim.submitted_at,
          updated_at: claim.updated_at,
          type: "claim"
        }
      })
    }

    const encounterHistory = providerRequests.map((encounter) => {
      const requestServices = parseServicesPayload(encounter.services)
      const requestServiceLabels = (
        requestServices.length > 0
          ? requestServices
          : (encounter.request_items || [])
      )
        .map((service: any) =>
          normalizeServiceLabel(
            service?.service_name ||
            service?.name ||
            service?.service_id ||
            service?.id
          )
        )
        .filter(Boolean)

      const diagnosisReferencedCode = encounter.diagnosis
        ? (encounter.diagnosis.match(/Additional services for approval code:\s*([A-Z0-9\/-]+)/i)?.[1] || null)
        : null

      let matchingApprovalCode: any = null
      if (diagnosisReferencedCode) {
        matchingApprovalCode = approvalCodes.find(
          (code: any) => code.approval_code === diagnosisReferencedCode
        ) || null
      }

      if (!matchingApprovalCode && encounter.claim_id) {
        matchingApprovalCode = approvalCodes.find((code: any) =>
          code.claim_id === encounter.claim_id &&
          code.enrollee_id === encounter.enrollee_id
        ) || null
      }

      if (!matchingApprovalCode && requestServiceLabels.length > 0) {
        const candidateCodes = approvalCodes
          .filter((code: any) =>
            code.enrollee_id === encounter.enrollee_id &&
            code.hospital === encounter.hospital &&
            code.provider_id === encounter.provider_id &&
            code.created_at <= encounter.updated_at
          )
          .map((code: any) => {
            const codeServices = Array.isArray(code.service_items) && code.service_items.length > 0
              ? code.service_items
              : parseServicesPayload(code.services)
            const codeServiceLabels = codeServices
              .map((service: any) =>
                normalizeServiceLabel(
                  service?.service_name ||
                  service?.name ||
                  service?.service_id ||
                  service?.id
                )
              )
              .filter(Boolean)

            const overlapCount = requestServiceLabels.filter((label: string) =>
              codeServiceLabels.includes(label)
            ).length

            return {
              code,
              overlapCount,
              createdAt: new Date(code.created_at).getTime(),
            }
          })
          .filter((candidate: any) => candidate.overlapCount > 0)
          .sort((a: any, b: any) => {
            if (b.overlapCount !== a.overlapCount) {
              return b.overlapCount - a.overlapCount
            }

            return b.createdAt - a.createdAt
          })

        matchingApprovalCode = candidateCodes[0]?.code || null
      }

      const enrolleeName = encounter.enrollee
        ? `${encounter.enrollee.first_name} ${encounter.enrollee.last_name}`.trim()
        : ""
      const providerRequestStatus =
        encounter.status === "DELETED" || matchingApprovalCode?.is_deleted
          ? "DELETED"
          : encounter.status
      return {
        id: encounter.id,
        claim_id: encounter.claim_id || null,
        approval_code: matchingApprovalCode?.approval_code || null,
        request_id: encounter.request_id || `REQ-${encounter.id.slice(-8).toUpperCase()}`,
        hospital: encounter.provider?.facility_name || encounter.hospital || "Unknown Provider",
        provider_name: encounter.provider?.facility_name || encounter.hospital || "",
        enrollee_name: enrolleeName,
        enrollee_id: encounter.enrollee?.enrollee_id || "",
        diagnosis: encounter.diagnosis || "",
        services: encounter.services || "",
        amount: Number(encounter.amount || 0),
        status: providerRequestStatus,
        created_at: encounter.created_at,
        updated_at: encounter.updated_at,
        type: "provider_request"
      }
    })

    const approvalCodeEncounters = approvalCodes.map((code) => {
      const enrolleeName = code.enrollee_name ||
        (code.enrollee ? `${code.enrollee.first_name} ${code.enrollee.last_name}`.trim() : "")
      // Use relational service_items for proper service/drug parsing
      const serviceItems = (code.service_items || []).map(s => ({ service_name: s.service_name, category: s.category }))
      const approvalCodeStatus = code.is_deleted ? "DELETED" : code.status
      return {
        id: code.id,
        claim_id: code.claim_id || null,
        approval_code: code.approval_code,
        hospital: code.hospital,
        provider_name: code.provider?.facility_name || "",
        enrollee_name: enrolleeName,
        enrollee_id: code.beneficiary_id || code.enrollee?.enrollee_id || "",
        diagnosis: code.diagnosis || "",
        services: serviceItems.length > 0 ? serviceItems : (code.services || ""),
        amount: Number(code.amount || 0),
        status: approvalCodeStatus,
        created_at: code.created_at,
        updated_at: code.updated_at,
        type: "approval_code"
      }
    })

    const combined = [...encounterHistory, ...approvalCodeEncounters, ...claimEncounters].sort((a, b) =>
      new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
    )

    const getEncounterKey = (record: any) => {
      if (record.claim_id) {
        return `claim:${record.claim_id}`
      }

      const approvalCode = String(record.approval_code || "").trim()
      const enrolleeId = String(record.enrollee_id || "").trim()
      const diagnosisReference = String(record.diagnosis || "").match(/Additional services for approval code:\s*([A-Z0-9\/-]+)/i)?.[1]

      if (diagnosisReference) {
        return `approval:${diagnosisReference}::${enrolleeId}`
      }

      if (record.type === "approval_code" && approvalCode) {
        return `approval:${approvalCode}::${enrolleeId}`
      }

      if (record.type === "provider_request" && approvalCode) {
        return `request:${approvalCode}::${enrolleeId}`
      }

      return `${record.type}::${record.id}`
    }

    const hasServicePayload = (services: any) => {
      if (Array.isArray(services)) return services.length > 0
      if (typeof services === "string") return services.trim().length > 0
      return Boolean(services)
    }

    const pickDisplayCode = (primary: string, secondary: string) => {
      const normalizedPrimary = String(primary || "").trim()
      const normalizedSecondary = String(secondary || "").trim()
      const primaryIsRequestId = normalizedPrimary.toUpperCase().startsWith("REQ-")
      const secondaryIsRequestId = normalizedSecondary.toUpperCase().startsWith("REQ-")

      if (normalizedPrimary && !primaryIsRequestId) return normalizedPrimary
      if (normalizedSecondary && !secondaryIsRequestId) return normalizedSecondary
      return normalizedPrimary || normalizedSecondary
    }

    const mergedByEncounter = new Map<string, any>()
    const resolveMergedStatus = (existingStatus: string | null | undefined, incomingStatus: string | null | undefined) => {
      const left = String(existingStatus || "").toUpperCase()
      const right = String(incomingStatus || "").toUpperCase()

      if (left === "DELETED" || right === "DELETED") {
        return "DELETED"
      }

      return existingStatus || incomingStatus
    }

    for (const record of combined) {
      const key = getEncounterKey(record)
      const existing = mergedByEncounter.get(key)

      if (!existing) {
        mergedByEncounter.set(key, { ...record })
        continue
      }

      mergedByEncounter.set(key, {
        ...existing,
        ...record,
        id: existing.id,
        claim_id: existing.claim_id || record.claim_id || null,
        approval_code: pickDisplayCode(existing.approval_code, record.approval_code),
        hospital: existing.hospital || record.hospital,
        provider_name: existing.provider_name || record.provider_name,
        enrollee_name: existing.enrollee_name || record.enrollee_name,
        enrollee_id: existing.enrollee_id || record.enrollee_id,
        diagnosis: existing.diagnosis || record.diagnosis,
        services: hasServicePayload(existing.services) ? existing.services : record.services,
        amount: existing.amount || record.amount,
        status: resolveMergedStatus(existing.status, record.status),
        created_at: existing.created_at || record.created_at,
        updated_at: existing.updated_at || record.updated_at || existing.created_at || record.created_at,
        type: existing.type || record.type,
      })
    }

    const deduped = Array.from(mergedByEncounter.values()).sort((a, b) =>
      new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
    )

    const allCount = deduped.length
    const paginatedEncounters = deduped.slice((page - 1) * limit, (page - 1) * limit + limit)

    return NextResponse.json({
      success: true,
      encounters: paginatedEncounters,
      utilization,
      pagination: {
        page,
        limit,
        total: allCount,
        pages: Math.max(1, Math.ceil(allCount / limit))
      }
    })
  } catch (error) {
    console.error("Error fetching encounter history:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch encounter history",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
