import { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

type StatisticsEventParams = {
  event: string
  module: string
  stage?: string
  outcome?: "success" | "failed" | "started"
  actorType?: "enrollee" | "staff" | "provider" | "system"
  actorId?: string | null
  enrolleeId?: string | null
  providerId?: string | null
  metadata?: Record<string, unknown>
  req?: NextRequest
}

let cachedSystemUserId: string | null = null
let cacheLoadedAt = 0
const CACHE_TTL_MS = 10 * 60 * 1000

async function resolveSystemUserId(): Promise<string | null> {
  const now = Date.now()
  if (cachedSystemUserId && now - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedSystemUserId
  }

  const preferredRoles = ["SUPER_ADMIN", "SUPERADMIN", "ADMIN", "CALL_CENTRE", "CALL_CENTRE_AGENT"]

  const preferred = await prisma.user.findFirst({
    where: {
      status: "ACTIVE",
      role: {
        name: { in: preferredRoles },
      },
    },
    select: { id: true },
    orderBy: { created_at: "asc" },
  })

  if (preferred?.id) {
    cachedSystemUserId = preferred.id
    cacheLoadedAt = now
    return preferred.id
  }

  const fallback = await prisma.user.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true },
    orderBy: { created_at: "asc" },
  })

  cachedSystemUserId = fallback?.id || null
  cacheLoadedAt = now
  return cachedSystemUserId
}

function parseIpAddress(req?: NextRequest): string | null {
  if (!req) return null
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null
  }
  return req.headers.get("x-real-ip")
}

function parseUserAgent(req?: NextRequest): string | null {
  if (!req) return null
  return req.headers.get("user-agent")
}

export async function trackStatisticsEvent(params: StatisticsEventParams): Promise<void> {
  try {
    const systemUserId = await resolveSystemUserId()
    if (!systemUserId) return

    const payload = {
      event: params.event,
      module: params.module,
      stage: params.stage || null,
      outcome: params.outcome || "success",
      actorType: params.actorType || "system",
      actorId: params.actorId || null,
      enrolleeId: params.enrolleeId || null,
      providerId: params.providerId || null,
      metadata: params.metadata || {},
    } as Prisma.InputJsonValue

    await prisma.auditLog.create({
      data: {
        user_id: systemUserId,
        action: `STAT_${params.event.toUpperCase()}`,
        resource: "statistics_event",
        resource_id: params.actorId || params.enrolleeId || params.providerId || null,
        ip_address: parseIpAddress(params.req),
        user_agent: parseUserAgent(params.req),
        new_values: payload,
      },
    })
  } catch (error) {
    console.error("[STATISTICS_EVENT_TRACKING_FAILED]", error)
  }
}
