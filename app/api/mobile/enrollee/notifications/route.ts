/**
 * GET /api/mobile/enrollee/notifications
 * Enrollee-scoped notifications: approval code status changes, appointment updates.
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileToken } from "@/lib/mobile-auth"
import fs from "fs"
import path from "path"

const logFile = path.join(process.cwd(), "tmp", "api_logs.txt");
function logToFile(msg: string) {
  const timestamp = new Date().toISOString();
  try {
    fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
  } catch (e) {}
}

export async function GET(req: NextRequest) {
  logToFile("[DEBUG] GET /api/mobile/enrollee/notifications - Starting");
  try {
    const session = await verifyMobileToken(req)
    if (!session || session.role !== "ENROLLEE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const startPrincipal = Date.now();
    const principal = await prisma.principalAccount.findUnique({
      where: { id: session.id },
      select: { id: true, enrollee_id: true, first_name: true, last_name: true },
    })
    logToFile(`[DEBUG] Notifications principal fetch took: ${Date.now() - startPrincipal}ms`);

    if (!principal) {
      return NextResponse.json({ notifications: [] })
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const startQueries = Date.now();
    const [approvalCodes, appointments, requests] = await Promise.all([
      prisma.approvalCode.findMany({
        where: {
          enrollee_id: principal.id,
          updated_at: { gte: since },
          status: { in: ["APPROVED", "PARTIAL", "REJECTED"] },
        },
        orderBy: { updated_at: "desc" },
        take: 20,
        select: { id: true, approval_code: true, hospital: true, status: true, updated_at: true, services: true },
      }),
      prisma.telemedicineAppointment.findMany({
        where: {
          enrollee_id: principal.id,
          updated_at: { gte: since },
          status: { in: ["IN_PROGRESS", "COMPLETED", "CANCELLED"] },
        },
        orderBy: { updated_at: "desc" },
        take: 10,
        select: { id: true, clinic: true, specialization: true, status: true, scheduled_date: true, updated_at: true },
      }),
      prisma.providerRequest.findMany({
        where: {
          enrollee_id: principal.id,
          updated_at: { gte: since },
          status: { in: ["APPROVED", "PARTIAL", "REJECTED"] },
        },
        orderBy: { updated_at: "desc" },
        take: 10,
        select: { id: true, request_id: true, hospital: true, status: true, updated_at: true, rejection_reason: true },
      }),
    ]);
    logToFile(`[DEBUG] Notifications queries (parallel) took: ${Date.now() - startQueries}ms`);

    const notifications: any[] = []
    // ... processing logic same as before ...
    for (const code of approvalCodes) {
      const statusLabel = code.status === "APPROVED" ? "Approved" : code.status === "PARTIAL" ? "Partially Approved" : "Rejected"
      notifications.push({
        id: `ac-${code.id}`,
        type: "approval_code",
        title: `Approval Code ${statusLabel}`,
        message: `Your approval code ${code.approval_code} for ${code.hospital} has been ${statusLabel.toLowerCase()}.`,
        time: code.updated_at.toISOString(),
        data: { approvalCodeId: code.id },
      })
    }
    for (const appt of appointments) {
      const statusMap: any = { IN_PROGRESS: "is now in progress", COMPLETED: "has been completed", CANCELLED: "has been cancelled" }
      notifications.push({
        id: `appt-${appt.id}`,
        type: "telemedicine",
        title: `Appointment ${appt.status === "COMPLETED" ? "Completed" : appt.status === "CANCELLED" ? "Cancelled" : "In Progress"}`,
        message: `Your ${appt.specialization || ""} appointment at ${appt.clinic || "the clinic"} ${statusMap[appt.status] || "was updated"}.`,
        time: appt.updated_at.toISOString(),
        data: { appointmentId: appt.id },
      })
    }
    for (const req of requests) {
      const statusLabel = req.status === "APPROVED" ? "Approved" : req.status === "PARTIAL" ? "Partially Approved" : "Rejected"
      notifications.push({
        id: `req-${req.id}`,
        type: "encounter_code",
        title: `Encounter Code Request ${statusLabel}`,
        message: `Your request to ${req.hospital} (Ref: ${req.request_id || req.id.slice(0, 8)}) has been ${statusLabel.toLowerCase()}.${req.rejection_reason ? ` Reason: ${req.rejection_reason}` : ""}`,
        time: req.updated_at.toISOString(),
        data: { requestId: req.id },
      })
    }

    notifications.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    logToFile("[DEBUG] GET /api/mobile/enrollee/notifications - Success");
    return NextResponse.json({ notifications: notifications.slice(0, 30) })
  } catch (error) {
    logToFile(`[ERROR] Notifications API: ${error}`);
    console.error("[MOBILE_ENROLLEE_NOTIFICATIONS]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
