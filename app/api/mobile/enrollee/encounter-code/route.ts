/**
 * POST /api/mobile/enrollee/encounter-code
 * Enrollee submits a request for an encounter code (ProviderRequest).
 * The Call Centre reviews and generates an ApprovalCode.
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileToken } from "@/lib/mobile-auth"
import { trackStatisticsEvent } from "@/lib/statistics-events"

function generateRequestId(): string {
  const ts = Date.now().toString().slice(-6)
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase()
  return `MREQ${ts}${rand}`
}

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
      },
    })

    if (!principal) {
      return NextResponse.json({ error: "Enrollee account not found" }, { status: 404 })
    }

    const { hospital: rawHospital, services, diagnosis, admissionRequired, providerId, appointment_date } = await req.json()

    if (!services?.toString().trim()) {
      await trackStatisticsEvent({
        event: "encounter_request_submit",
        module: "enrolleeapp",
        stage: "encounter_request",
        outcome: "failed",
        actorType: "enrollee",
        actorId: session.id,
        enrolleeId: session.enrollee_id || null,
        metadata: { reason: "missing_services" },
        req,
      })
      return NextResponse.json({ error: "services are required" }, { status: 400 })
    }
    if (!rawHospital && !providerId) {
      await trackStatisticsEvent({
        event: "encounter_request_submit",
        module: "enrolleeapp",
        stage: "encounter_request",
        outcome: "failed",
        actorType: "enrollee",
        actorId: session.id,
        enrolleeId: session.enrollee_id || null,
        metadata: { reason: "missing_provider" },
        req,
      })
      return NextResponse.json({ error: "hospital or providerId is required" }, { status: 400 })
    }

    // Resolve provider id and hospital name
    let resolvedProviderId: string = providerId
    let hospitalName: string = rawHospital

    if (resolvedProviderId && !hospitalName) {
      // Fetch facility name when only the ID was sent
      const providerRecord = await prisma.provider.findUnique({
        where: { id: resolvedProviderId },
        select: { facility_name: true },
      })
      hospitalName = providerRecord?.facility_name ?? "Unknown"
    }

    if (!resolvedProviderId) {
      const provider = await prisma.provider.findFirst({
        where: { facility_name: { contains: hospitalName, mode: "insensitive" }, status: "ACTIVE" },
        select: { id: true },
      })
      if (!provider) {
        await trackStatisticsEvent({
          event: "encounter_request_submit",
          module: "enrolleeapp",
          stage: "encounter_request",
          outcome: "failed",
          actorType: "enrollee",
          actorId: session.id,
          enrolleeId: session.enrollee_id || null,
          metadata: { reason: "provider_not_found", hospitalName },
          req,
        })
        return NextResponse.json(
          { error: `No active provider found for "${hospitalName}". Please select from the provider list.` },
          { status: 404 }
        )
      }
      resolvedProviderId = provider.id
    }

    // Build services string — append preferred visit date if supplied
    const servicesStr = typeof services === "string" ? services : JSON.stringify(services)
    const fullServices = appointment_date
      ? `${servicesStr} (Preferred visit date: ${appointment_date})`
      : servicesStr

    const request = await prisma.providerRequest.create({
      data: {
        enrollee_id: principal.id,
        provider_id: resolvedProviderId,
        hospital: hospitalName,
        services: fullServices,
        amount: 0, // Call Centre sets amount after review
        diagnosis: diagnosis || null,
        admission_required: admissionRequired || false,
        beneficiary_id: principal.enrollee_id,
        beneficiary_name: `${principal.first_name} ${principal.last_name}`,
        tariff_type: "PRIVATE",
        request_id: generateRequestId(),
        status: "PENDING",
      },
    })

    await trackStatisticsEvent({
      event: "encounter_request_submit",
      module: "enrolleeapp",
      stage: "encounter_request",
      outcome: "success",
      actorType: "enrollee",
      actorId: session.id,
      enrolleeId: principal.enrollee_id,
      providerId: resolvedProviderId,
      metadata: { requestId: request.id, status: request.status },
      req,
    })

    return NextResponse.json(
      { message: "Encounter code request submitted successfully", request },
      { status: 201 }
    )
  } catch (error) {
    console.error("[MOBILE_ENCOUNTER_CODE]", error)
    await trackStatisticsEvent({
      event: "encounter_request_submit",
      module: "enrolleeapp",
      stage: "encounter_request",
      outcome: "failed",
      actorType: "system",
      metadata: { reason: "server_error" },
      req,
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
