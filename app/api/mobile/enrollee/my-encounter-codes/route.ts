/**
 * GET  /api/mobile/enrollee/my-encounter-codes
 *   Returns all ApprovalCodes generated for this enrollee (principal + their dependents).
 *
 * POST /api/mobile/enrollee/my-encounter-codes
 *   Directly generates an ApprovalCode (encounter code) — bypasses the ProviderRequest
 *   approval queue. The record appears immediately in the Call Centre → Manage Encounter Codes
 *   table with status PENDING ("New"). Once the provider marks it used it becomes APPROVED ("Used").
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileToken } from "@/lib/mobile-auth"
import { trackStatisticsEvent } from "@/lib/statistics-events"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const CODE_LENGTH = 4

function randomCode(): string {
  return Array.from(
    { length: CODE_LENGTH },
    () => CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]
  ).join("")
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = randomCode()
    const existing = await prisma.approvalCode.findUnique({
      where: { approval_code: candidate },
    })
    if (!existing) return candidate
  }
  throw new Error("Could not generate a unique encounter code — please try again")
}

// ---------------------------------------------------------------------------
// GET — list enrollee's ApprovalCodes
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await verifyMobileToken(req)
    if (!session || session.role !== "ENROLLEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const principal = await prisma.principalAccount.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        enrollee_id: true,
        dependents: { select: { dependent_id: true } },
      },
    })
    if (!principal) {
      return NextResponse.json({ error: "Enrollee not found" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "20"))
    const skip = (page - 1) * limit

    // Include codes for the principal AND all their dependents (matched via beneficiary_id)
    const dependentIds = principal.dependents.map((d) => d.dependent_id)
    const beneficiaryIds = [principal.enrollee_id, ...dependentIds]

    const where: any = {
      enrollee_id: principal.id,
      is_deleted: false,
      // Exclude classic approval-code prefixes so only encounter codes appear
      NOT: [
        { approval_code: { startsWith: "APR/" } },
        { approval_code: { startsWith: "APR-" } },
        { approval_code: { startsWith: "M-APR-" } },
      ],
    }

    const [codes, total] = await Promise.all([
      prisma.approvalCode.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          approval_code: true,
          enrollee_name: true,
          beneficiary_id: true,
          hospital: true,
          provider_id: true,
          services: true,
          diagnosis: true,
          status: true,
          admission_required: true,
          created_at: true,
          provider: {
            select: { id: true, facility_name: true, address: true },
          },
        },
      }),
      prisma.approvalCode.count({ where }),
    ])

    await trackStatisticsEvent({
      event: "encounter_codes_view",
      module: "enrolleeapp",
      stage: "encounter_code",
      outcome: "success",
      actorType: "enrollee",
      actorId: session.id,
      enrolleeId: principal.enrollee_id,
      metadata: { total, page, limit },
      req,
    })

    return NextResponse.json({
      codes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("[MOBILE_MY_ENCOUNTER_CODES_GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST — generate a new encounter code (self-service)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await verifyMobileToken(req)
    if (!session || session.role !== "ENROLLEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const principal = await prisma.principalAccount.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        enrollee_id: true,
        dependents: {
          select: {
            id: true,
            dependent_id: true,
            first_name: true,
            last_name: true,
            relationship: true,
            status: true,
          },
        },
      },
    })
    if (!principal) {
      return NextResponse.json({ error: "Enrollee not found" }, { status: 404 })
    }

    const body = await req.json()
    const { providerId, dependentId } = body

    if (!providerId) {
      return NextResponse.json(
        { error: "Please select a hospital/provider" },
        { status: 400 }
      )
    }

    // Resolve provider
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      select: { id: true, facility_name: true, status: true },
    })
    if (!provider || provider.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Selected provider is not active. Please choose another." },
        { status: 400 }
      )
    }

    // Determine beneficiary: principal or a dependent
    let beneficiaryName: string
    let beneficiaryId: string
    let enrolleeRecordId: string = principal.id // ApprovalCode.enrollee_id must be a PrincipalAccount.id

    if (dependentId) {
      const dep = principal.dependents.find((d) => d.id === dependentId)
      if (!dep) {
        return NextResponse.json(
          { error: "Dependent not found or does not belong to this account" },
          { status: 400 }
        )
      }
      if (dep.status && dep.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "This dependent's coverage is not active" },
          { status: 400 }
        )
      }
      beneficiaryName = `${dep.first_name} ${dep.last_name}`
      beneficiaryId = dep.dependent_id
    } else {
      beneficiaryName = `${principal.first_name} ${principal.last_name}`
      beneficiaryId = principal.enrollee_id
    }

    // We need a User record for generated_by_id (schema requirement).
    // Use the first SUPERADMIN or ADMIN as the "system" generator.
    const systemUser = await prisma.user.findFirst({
      where: {
        role: { name: { in: ["SUPERADMIN", "ADMIN", "CALL_CENTRE_AGENT"] } },
        status: "ACTIVE",
      },
      orderBy: { created_at: "asc" },
      select: { id: true },
    })
    if (!systemUser) {
      return NextResponse.json(
        { error: "System configuration error — no admin user found" },
        { status: 500 }
      )
    }

    const code = await uniqueCode()

    const record = await prisma.approvalCode.create({
      data: {
        approval_code: code,
        enrollee_id: enrolleeRecordId,
        enrollee_name: beneficiaryName,
        beneficiary_id: beneficiaryId,
        hospital: provider.facility_name,
        provider_id: provider.id,
        services: "General Consultation",
        amount: 0,
        diagnosis: null,
        admission_required: false,
        status: "PENDING", // "New" in the call-centre table
        generated_by_id: systemUser.id,
        is_manual: false,
      },
      include: {
        provider: { select: { id: true, facility_name: true, address: true } },
      },
    })

    // Audit trail
    await prisma.auditLog.create({
      data: {
        user_id: systemUser.id,
        action: "APPROVAL_CODE_GENERATE",
        resource: "approval_code",
        resource_id: record.id,
        new_values: {
          approval_code: record.approval_code,
          enrollee_name: record.enrollee_name,
          beneficiary_id: record.beneficiary_id,
          hospital: record.hospital,
          source: "MOBILE_SELF_SERVICE",
        },
      },
    })

    await trackStatisticsEvent({
      event: "encounter_code_generate",
      module: "enrolleeapp",
      stage: "encounter_code",
      outcome: "success",
      actorType: "enrollee",
      actorId: session.id,
      enrolleeId: beneficiaryId,
      providerId: provider.id,
      metadata: {
        approvalCodeId: record.id,
        approvalCode: record.approval_code,
        dependent: Boolean(dependentId),
      },
      req,
    })

    return NextResponse.json(
      {
        message: "Encounter code generated",
        code: {
          id: record.id,
          approval_code: record.approval_code,
          enrollee_name: record.enrollee_name,
          beneficiary_id: record.beneficiary_id,
          hospital: record.hospital,
          provider: record.provider,
          status: record.status,
          created_at: record.created_at,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("[MOBILE_MY_ENCOUNTER_CODES_POST]", error)
    await trackStatisticsEvent({
      event: "encounter_code_generate",
      module: "enrolleeapp",
      stage: "encounter_code",
      outcome: "failed",
      actorType: "system",
      metadata: { reason: "server_error" },
      req,
    })
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
