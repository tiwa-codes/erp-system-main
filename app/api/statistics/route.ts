import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import type { StatisticsPeriod, StatisticsSnapshot } from "@/lib/statistics-data"

export const dynamic = "force-dynamic"

type RegionFilter = "all" | "north" | "southwest" | "southsouth" | "southeast"
type PlatformFilter = "all" | "android" | "ios" | "web"
type ModuleFilter =
  | "all"
  | "claims"
  | "provider"
  | "underwriting"
  | "callcentre"
  | "telemedicine"
  | "enrolleeapp"

type UserLite = {
  id: string
  first_name: string
  last_name: string
  last_login_at: Date | null
  status: string
  provider_id: string | null
  contact_address: string | null
  role: { name: string } | null
  department: { name: string } | null
}

type ProviderLite = {
  id: string
  facility_name: string
  address: string
  created_at: Date
  status: string
}

type PrincipalLite = {
  id: string
  enrollee_id: string
  first_name: string
  last_name: string
  state: string | null
  region: string | null
}

type DependentLite = {
  dependent_id: string
  first_name: string
  last_name: string
  state: string | null
  region: string | null
}

type LoginLogLite = {
  user_id: string
  action: string
  created_at: Date
  user_agent: string | null
}

type ModuleLogLite = {
  user_id: string
  resource: string
  action: string
  created_at: Date
}

type OtpLite = {
  enrollee_id: string
  used: boolean
  created_at: Date
}

type ApprovalCodeLite = {
  provider_id: string | null
  enrollee_id: string
  created_at: Date
  status: string
}

type ClaimLite = {
  provider_id: string | null
  enrollee_id: string
  created_at: Date
  status: string
}

type ProviderRequestLite = {
  provider_id: string
  enrollee_id: string
  created_at: Date
  status: string
}

type AppointmentLite = {
  enrollee_id: string
  status: string
  created_at: Date
}

type StatisticsEventLogLite = {
  action: string
  created_at: Date
  user_agent: string | null
  new_values: unknown
}

type ParsedStatisticsEvent = {
  name: string
  module: string
  stage: string | null
  outcome: "success" | "failed" | "started"
  actorType: string | null
  actorId: string | null
  enrolleeId: string | null
  providerId: string | null
  platform: "Android" | "iOS" | "Web"
  userAgent: string | null
  createdAt: Date
  metadata: Record<string, unknown>
}

type LoginEvent = {
  userId: string
  userName: string
  userType: "ERP Staff" | "Provider"
  platform: "Android" | "iOS" | "Web"
  device: string
  loginAt: Date
  logoutAt?: Date
  sessionMs?: number
  status: "Success"
  failureReason: string
}

const PERIODS: StatisticsPeriod[] = ["today", "7days", "30days", "90days"]
const REGIONS: RegionFilter[] = ["all", "north", "southwest", "southsouth", "southeast"]
const PLATFORMS: PlatformFilter[] = ["all", "android", "ios", "web"]
const MODULES: ModuleFilter[] = ["all", "claims", "provider", "underwriting", "callcentre", "telemedicine", "enrolleeapp"]

const STATE_GROUPS: Record<Exclude<RegionFilter, "all">, string[]> = {
  north: [
    "adamawa",
    "bauchi",
    "benue",
    "borno",
    "fct",
    "gombe",
    "jigawa",
    "kaduna",
    "kano",
    "katsina",
    "kebbi",
    "kogi",
    "kwara",
    "nasarawa",
    "niger",
    "plateau",
    "sokoto",
    "taraba",
    "yobe",
    "zamfara",
    "abuja",
  ],
  southwest: ["ekiti", "lagos", "ogun", "ondo", "osun", "oyo"],
  southsouth: ["akwa ibom", "bayelsa", "cross river", "delta", "edo", "rivers"],
  southeast: ["abia", "anambra", "ebonyi", "enugu", "imo"],
}

const MODULE_LABELS: Record<string, string> = {
  claims: "Claims",
  provider: "Provider Management",
  underwriting: "Underwriting",
  callcentre: "Call Centre",
  telemedicine: "Telemedicine",
  finance: "Finance",
  hr: "HR",
  enrolleeapp: "Enrollee App",
}

const ENROLLEE_EVENT_MODULES = new Set(["auth", "enrolleeapp", "coverage", "history", "encounter"])

type DailyFeatureKey = "providerSearch" | "benefits" | "telemedicine" | "chat" | "claims" | "profile"

const DAILY_FEATURE_LABELS: Record<DailyFeatureKey, string> = {
  providerSearch: "Provider Search",
  benefits: "Benefits",
  telemedicine: "Telemedicine",
  chat: "Chat",
  claims: "Claims",
  profile: "Profile",
}

function safePeriod(value: string | null): StatisticsPeriod {
  if (value && PERIODS.includes(value as StatisticsPeriod)) {
    return value as StatisticsPeriod
  }
  return "7days"
}

function safeRegion(value: string | null): RegionFilter {
  if (value && REGIONS.includes(value as RegionFilter)) {
    return value as RegionFilter
  }
  return "all"
}

function safePlatform(value: string | null): PlatformFilter {
  if (value && PLATFORMS.includes(value as PlatformFilter)) {
    return value as PlatformFilter
  }
  return "all"
}

function safeModule(value: string | null): ModuleFilter {
  if (value && MODULES.includes(value as ModuleFilter)) {
    return value as ModuleFilter
  }
  return "all"
}

function getRange(period: StatisticsPeriod): { startDate: Date; endDate: Date } {
  const now = new Date()
  if (period === "today") {
    return { startDate: startOfDay(now), endDate: now }
  }

  const dayCountMap: Record<Exclude<StatisticsPeriod, "today">, number> = {
    "7days": 7,
    "30days": 30,
    "90days": 90,
  }
  const days = dayCountMap[period]
  const startDate = startOfDay(new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000))
  return { startDate, endDate: now }
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos",
  }).format(date)
}

function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(date)
}

function formatRelativeDateTime(date: Date): string {
  const today = startOfDay(new Date())
  const day = startOfDay(date)
  const diffDays = Math.round((today.getTime() - day.getTime()) / (24 * 60 * 60 * 1000))

  if (diffDays === 0) return `Today ${formatTime(date)}`
  if (diffDays === 1) return `Yesterday ${formatTime(date)}`
  return `${formatDateLabel(date)} ${formatTime(date)}`
}

function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return "-"
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes <= 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

function classifyPlatform(userAgent?: string | null): "Android" | "iOS" | "Web" {
  const ua = (userAgent || "").toLowerCase()
  if (ua.includes("android")) return "Android"
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) return "iOS"
  return "Web"
}

function extractDeviceLabel(userAgent?: string | null): string {
  const ua = userAgent || ""
  if (!ua) return "-"
  const lower = ua.toLowerCase()
  if (lower.includes("android")) return "Android Device"
  if (lower.includes("iphone")) return "iPhone"
  if (lower.includes("ipad")) return "iPad"
  if (lower.includes("edg")) return "Edge"
  if (lower.includes("firefox")) return "Firefox"
  if (lower.includes("safari") && !lower.includes("chrome")) return "Safari"
  if (lower.includes("chrome")) return "Chrome"
  return "Web Browser"
}

function extractOsVersion(userAgent?: string | null): string {
  const ua = userAgent || ""
  const androidMatch = ua.match(/Android\s+([0-9.]+)/i)
  if (androidMatch?.[1]) return `Android ${androidMatch[1]}`

  const iosMatch = ua.match(/OS\s([0-9_]+)/i)
  if (iosMatch?.[1]) return `iOS ${iosMatch[1].replace(/_/g, ".")}`
  return "-"
}

function extractAppVersion(userAgent?: string | null): string {
  const ua = userAgent || ""
  const appVersionMatch = ua.match(/(?:app|version)[/ ]([0-9]+(?:\.[0-9]+){1,3})/i)
  if (appVersionMatch?.[1]) return appVersionMatch[1]
  return "Unknown"
}

function resolveRegionFromStateOrRegion(state?: string | null, region?: string | null): RegionFilter | null {
  const normalizedRegion = (region || "").trim().toLowerCase().replace(/\s+/g, "")
  if (normalizedRegion === "north") return "north"
  if (normalizedRegion === "southwest") return "southwest"
  if (normalizedRegion === "southsouth") return "southsouth"
  if (normalizedRegion === "southeast") return "southeast"

  const normalizedState = (state || "").trim().toLowerCase()
  if (!normalizedState) return null

  for (const [mappedRegion, states] of Object.entries(STATE_GROUPS)) {
    if (states.some((s) => normalizedState.includes(s))) {
      return mappedRegion as RegionFilter
    }
  }
  return null
}

function resolveRegionFromAddress(address?: string | null): RegionFilter | null {
  const normalized = (address || "").trim().toLowerCase()
  if (!normalized) return null

  for (const [mappedRegion, states] of Object.entries(STATE_GROUPS)) {
    if (states.some((stateName) => normalized.includes(stateName))) {
      return mappedRegion as RegionFilter
    }
  }
  return null
}

function resourceToModuleKey(
  resource: string
): "claims" | "provider" | "underwriting" | "callcentre" | "telemedicine" | "finance" | "hr" | "enrolleeapp" | "other" {
  const r = resource.toLowerCase()
  if (r.includes("claims") || r.includes("approval_code")) return "claims"
  if (r.includes("provider") || r.includes("request-from-provider")) return "provider"
  if (r.includes("underwriting")) return "underwriting"
  if (r.includes("call-centre") || r.includes("call_centre")) return "callcentre"
  if (r.includes("telemedicine")) return "telemedicine"
  if (r.includes("finance")) return "finance"
  if (r.includes("hr")) return "hr"
  if (r.includes("auth") || r.includes("enrollee") || r.includes("coverage") || r.includes("history")) return "enrolleeapp"
  return "other"
}

function statisticsEventToModuleKey(
  event: ParsedStatisticsEvent
): "claims" | "provider" | "underwriting" | "callcentre" | "telemedicine" | "finance" | "hr" | "enrolleeapp" | "other" {
  const moduleName = event.module.toLowerCase()
  if (moduleName.includes("claims")) return "claims"
  if (moduleName.includes("provider")) return "provider"
  if (moduleName.includes("underwriting")) return "underwriting"
  if (moduleName.includes("callcentre") || moduleName.includes("call-centre")) return "callcentre"
  if (moduleName.includes("telemedicine")) return "telemedicine"
  if (moduleName.includes("finance")) return "finance"
  if (moduleName.includes("hr")) return "hr"
  if (ENROLLEE_EVENT_MODULES.has(moduleName) || event.actorType === "enrollee") return "enrolleeapp"
  return "other"
}

function statisticsEventToFeatureKey(eventName: string): DailyFeatureKey | null {
  if (eventName === "provider_search" || eventName === "provider_list_view") return "providerSearch"
  if (eventName === "coverage_view" || eventName === "available_services_view") return "benefits"
  if (
    eventName === "telemedicine_appointments_view" ||
    eventName === "telemedicine_appointment_detail_view" ||
    eventName === "telemedicine_booking_create"
  ) {
    return "telemedicine"
  }
  if (eventName.includes("chat")) return "chat"
  if (
    eventName === "claims_view" ||
    eventName === "encounter_status_view" ||
    eventName === "encounter_codes_view" ||
    eventName === "encounter_code_generate" ||
    eventName === "encounter_request_submit"
  ) {
    return "claims"
  }
  if (eventName === "history_view" || eventName === "enrollee_login") return "profile"
  return null
}

function percent(part: number, total: number): number {
  if (!total || total <= 0) return 0
  return Math.round((part / total) * 100)
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function toFeatureName(moduleKey: string): string {
  switch (moduleKey) {
    case "claims":
      return "Claims"
    case "provider":
      return "Provider Usage"
    case "underwriting":
      return "Underwriting"
    case "callcentre":
      return "Call Centre"
    case "telemedicine":
      return "Telemedicine"
    case "finance":
      return "Finance"
    case "hr":
      return "HR"
    case "enrolleeapp":
      return "Enrollee App"
    default:
      return "General Usage"
  }
}

function buildDayKeys(days = 7): string[] {
  const keys: string[] = []
  const today = startOfDay(new Date())
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
    keys.push(formatDateLabel(day))
  }
  return keys
}

function matchesPlatform(filter: PlatformFilter, platform: "Android" | "iOS" | "Web"): boolean {
  if (filter === "all") return true
  if (filter === "android") return platform === "Android"
  if (filter === "ios") return platform === "iOS"
  return platform === "Web"
}

function parseStatisticsEventPayload(input: unknown): Record<string, unknown> {
  if (!input) return {}
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input)
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>
      return {}
    } catch {
      return {}
    }
  }
  if (typeof input === "object") return input as Record<string, unknown>
  return {}
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const hasPermission = await checkPermission(session.user.role as any, "statistics", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = safePeriod(searchParams.get("period"))
    const regionFilter = safeRegion(searchParams.get("region"))
    const platformFilter = safePlatform(searchParams.get("platform"))
    const moduleFilter = safeModule(searchParams.get("module"))
    const { startDate, endDate } = getRange(period)

    const trackedResources = [
      "claims",
      "approval_code",
      "provider",
      "providers",
      "request-from-provider",
      "underwriting",
      "call-centre",
      "call_centre",
      "telemedicine",
      "finance",
      "hr",
      "dashboard",
    ]

    const [
      usersRaw,
      providersRaw,
      principalsRaw,
      dependentsRaw,
      loginLogsRaw,
      moduleLogsRaw,
      otpRaw,
      approvalCodesRaw,
      claimsRaw,
      providerRequestsRaw,
      appointmentsRaw,
      statisticsEventsRaw,
      mobilePrincipalSignups,
      mobileDependentSignups,
    ] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          first_name: true,
          last_name: true,
          last_login_at: true,
          status: true,
          provider_id: true,
          contact_address: true,
          role: { select: { name: true } },
          department: { select: { name: true } },
        },
      }),
      prisma.provider.findMany({
        select: {
          id: true,
          facility_name: true,
          address: true,
          created_at: true,
          status: true,
        },
      }),
      prisma.principalAccount.findMany({
        select: {
          id: true,
          enrollee_id: true,
          first_name: true,
          last_name: true,
          state: true,
          region: true,
        },
      }),
      prisma.dependent.findMany({
        select: {
          dependent_id: true,
          first_name: true,
          last_name: true,
          state: true,
          region: true,
        },
      }),
      prisma.auditLog.findMany({
        where: {
          action: { in: ["LOGIN", "MOBILE_LOGIN", "LOGOUT"] },
          created_at: { gte: startDate, lte: endDate },
        },
        select: {
          user_id: true,
          action: true,
          created_at: true,
          user_agent: true,
        },
      }),
      prisma.auditLog.findMany({
        where: {
          created_at: { gte: startDate, lte: endDate },
          resource: { in: trackedResources },
        },
        select: {
          user_id: true,
          action: true,
          resource: true,
          created_at: true,
        },
      }),
      prisma.mobileOtp.findMany({
        where: { created_at: { gte: startDate, lte: endDate } },
        select: {
          enrollee_id: true,
          used: true,
          created_at: true,
        },
      }),
      prisma.approvalCode.findMany({
        where: {
          created_at: { gte: startDate, lte: endDate },
          is_deleted: false,
        },
        select: {
          provider_id: true,
          enrollee_id: true,
          created_at: true,
          status: true,
        },
      }),
      prisma.claim.findMany({
        where: { created_at: { gte: startDate, lte: endDate } },
        select: {
          provider_id: true,
          enrollee_id: true,
          created_at: true,
          status: true,
        },
      }),
      prisma.providerRequest.findMany({
        where: { created_at: { gte: startDate, lte: endDate } },
        select: {
          provider_id: true,
          enrollee_id: true,
          created_at: true,
          status: true,
        },
      }),
      prisma.telemedicineAppointment.findMany({
        where: { created_at: { gte: startDate, lte: endDate } },
        select: {
          enrollee_id: true,
          status: true,
          created_at: true,
        },
      }),
      prisma.auditLog.findMany({
        where: {
          resource: "statistics_event",
          created_at: { gte: startDate, lte: endDate },
        },
        select: {
          action: true,
          created_at: true,
          user_agent: true,
          new_values: true,
        },
      }),
      prisma.principalRegistration.count({
        where: {
          source: "MOBILE_APP",
          submitted_at: { gte: startDate, lte: endDate },
        },
      }),
      prisma.dependentRegistration.count({
        where: {
          source: "MOBILE_APP",
          submitted_at: { gte: startDate, lte: endDate },
        },
      }),
    ])

    const users = usersRaw as UserLite[]
    const providers = providersRaw as ProviderLite[]
    const principals = principalsRaw as PrincipalLite[]
    const dependents = dependentsRaw as DependentLite[]
    const loginLogs = loginLogsRaw as LoginLogLite[]
    const moduleLogs = moduleLogsRaw as ModuleLogLite[]
    const otpLogs = otpRaw as OtpLite[]
    const approvalCodes = approvalCodesRaw as ApprovalCodeLite[]
    const claims = claimsRaw as ClaimLite[]
    const providerRequests = providerRequestsRaw as ProviderRequestLite[]
    const appointments = appointmentsRaw as AppointmentLite[]
    const statisticsEventLogs = statisticsEventsRaw as StatisticsEventLogLite[]

    const userById = new Map(users.map((user) => [user.id, user]))
    const providerById = new Map(providers.map((provider) => [provider.id, provider]))

    const principalByEnrollee = new Map(
      principals.map((principal) => [
        principal.enrollee_id,
        {
          name: `${principal.first_name} ${principal.last_name}`.trim(),
          state: principal.state,
          region: resolveRegionFromStateOrRegion(principal.state, principal.region),
        },
      ])
    )
    const principalIdToEnrolleeId = new Map(principals.map((principal) => [principal.id, principal.enrollee_id]))
    const dependentById = new Map(
      dependents.map((dependent) => [
        dependent.dependent_id,
        {
          name: `${dependent.first_name} ${dependent.last_name}`.trim(),
          state: dependent.state,
          region: resolveRegionFromStateOrRegion(dependent.state, null),
        },
      ])
    )
    const resolveEnrolleeRegion = (enrolleeId: string): RegionFilter | null => {
      return principalByEnrollee.get(enrolleeId)?.region || dependentById.get(enrolleeId)?.region || null
    }

    const providerRegionById = new Map<string, RegionFilter | null>()
    for (const provider of providers) {
      providerRegionById.set(provider.id, resolveRegionFromAddress(provider.address))
    }

    const userRegionById = new Map<string, RegionFilter | null>()
    for (const user of users) {
      let userRegion: RegionFilter | null = null
      if (user.provider_id) {
        userRegion = providerRegionById.get(user.provider_id) || null
      } else {
        userRegion = resolveRegionFromAddress(user.contact_address || null)
      }
      userRegionById.set(user.id, userRegion)
    }

    const allowedProviderIds = new Set<string>()
    const allowedEnrolleeIds = new Set<string>()
    const allowedUserIds = new Set<string>()

    if (regionFilter === "all") {
      providers.forEach((provider) => allowedProviderIds.add(provider.id))
      principals.forEach((principal) => allowedEnrolleeIds.add(principal.enrollee_id))
      dependents.forEach((dependent) => allowedEnrolleeIds.add(dependent.dependent_id))
      users.forEach((user) => allowedUserIds.add(user.id))
    } else {
      for (const provider of providers) {
        if (providerRegionById.get(provider.id) === regionFilter) {
          allowedProviderIds.add(provider.id)
        }
      }
      for (const principal of principals) {
        const resolved = resolveRegionFromStateOrRegion(principal.state, principal.region)
        if (resolved === regionFilter) {
          allowedEnrolleeIds.add(principal.enrollee_id)
        }
      }
      for (const dependent of dependents) {
        const resolved = resolveRegionFromStateOrRegion(dependent.state, null)
        if (resolved === regionFilter) {
          allowedEnrolleeIds.add(dependent.dependent_id)
        }
      }
      for (const user of users) {
        if (userRegionById.get(user.id) === regionFilter) {
          allowedUserIds.add(user.id)
        }
      }
    }

    const parsedStatisticsEvents: ParsedStatisticsEvent[] = statisticsEventLogs.map((eventLog) => {
      const payload = parseStatisticsEventPayload(eventLog.new_values)
      const payloadEvent = String(payload.event || "").trim()
      const name = payloadEvent || eventLog.action.replace(/^STAT_/i, "").toLowerCase()
      const moduleName = String(payload.module || "").trim().toLowerCase()
      const outcomeRaw = String(payload.outcome || "success").toLowerCase()
      const outcome: "success" | "failed" | "started" =
        outcomeRaw === "failed" ? "failed" : outcomeRaw === "started" ? "started" : "success"
      const metadata =
        payload.metadata && typeof payload.metadata === "object"
          ? (payload.metadata as Record<string, unknown>)
          : {}

      return {
        name,
        module: moduleName,
        stage: payload.stage ? String(payload.stage) : null,
        outcome,
        actorType: payload.actorType ? String(payload.actorType) : null,
        actorId: payload.actorId ? String(payload.actorId) : null,
        enrolleeId: payload.enrolleeId ? String(payload.enrolleeId) : null,
        providerId: payload.providerId ? String(payload.providerId) : null,
        platform: classifyPlatform(eventLog.user_agent),
        userAgent: eventLog.user_agent,
        createdAt: eventLog.created_at,
        metadata,
      }
    })

    const scopedStatisticsEvents = parsedStatisticsEvents.filter((event) => {
      if (regionFilter !== "all") {
        if (event.providerId && !allowedProviderIds.has(event.providerId)) return false
        if (event.enrolleeId && !allowedEnrolleeIds.has(event.enrolleeId)) return false
        if (event.actorId && !event.enrolleeId && !event.providerId && !allowedUserIds.has(event.actorId)) return false
      }

      if (!matchesPlatform(platformFilter, event.platform)) return false

      if (moduleFilter !== "all") {
        const eventModule = event.module
        if (moduleFilter === "callcentre") {
          return eventModule === "callcentre" || eventModule === "call-centre"
        }
        if (moduleFilter === "enrolleeapp") {
          return event.actorType === "enrollee" || ENROLLEE_EVENT_MODULES.has(eventModule)
        }
        return eventModule === moduleFilter
      }

      return true
    })

    const countStatisticsEvents = (eventName: string, outcome?: "success" | "failed" | "started"): number => {
      return scopedStatisticsEvents.filter((event) => {
        if (event.name !== eventName) return false
        if (!outcome) return true
        return event.outcome === outcome
      }).length
    }

    const countUniqueEnrolleeEvents = (eventNames: string[], outcome?: "success" | "failed" | "started"): number => {
      const unique = new Set<string>()
      for (const event of scopedStatisticsEvents) {
        if (event.actorType !== "enrollee") continue
        if (!eventNames.includes(event.name)) continue
        if (outcome && event.outcome !== outcome) continue
        const enrolleeIdentifier = event.enrolleeId || event.actorId
        if (!enrolleeIdentifier) continue
        unique.add(enrolleeIdentifier)
      }
      return unique.size
    }

    const countFeatureEvents = (feature: DailyFeatureKey): number => {
      return scopedStatisticsEvents.filter((event) => {
        if (event.outcome !== "success") return false
        const key = statisticsEventToFeatureKey(event.name)
        return key === feature
      }).length
    }

    const filteredLoginLogs = loginLogs
      .filter((log) => allowedUserIds.has(log.user_id))
      .filter((log) => matchesPlatform(platformFilter, classifyPlatform(log.user_agent)))
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())

    const filteredModuleLogs = moduleLogs
      .filter((log) => allowedUserIds.has(log.user_id))
      .filter((log) => {
        if (moduleFilter === "all") return true
        const moduleKey = resourceToModuleKey(log.resource)
        if (moduleFilter === "callcentre") return moduleKey === "callcentre"
        if (moduleFilter === "enrolleeapp") {
          return moduleKey === "enrolleeapp" || log.resource.toLowerCase().includes("approval_code")
        }
        return moduleKey === moduleFilter
      })

    const filteredOtpLogs = otpLogs.filter((otp) => {
      if (regionFilter !== "all" && !allowedEnrolleeIds.has(otp.enrollee_id)) return false
      return true
    })

    const filteredApprovalCodes = approvalCodes.filter((code) => {
      if (regionFilter === "all") return true
      if (code.provider_id && allowedProviderIds.has(code.provider_id)) return true
      return allowedEnrolleeIds.has(code.enrollee_id)
    })

    const filteredClaims = claims.filter((claim) => {
      if (regionFilter === "all") return true
      if (claim.provider_id && allowedProviderIds.has(claim.provider_id)) return true
      return allowedEnrolleeIds.has(claim.enrollee_id)
    })

    const filteredProviderRequests = providerRequests.filter((requestRow) => {
      if (regionFilter === "all") return true
      if (allowedProviderIds.has(requestRow.provider_id)) return true
      return allowedEnrolleeIds.has(requestRow.enrollee_id)
    })

    const filteredAppointments = appointments.filter((appointment) => {
      const enrolleeIdentifier = principalIdToEnrolleeId.get(appointment.enrollee_id)
      if (!enrolleeIdentifier) return regionFilter === "all"
      if (regionFilter === "all") return true
      return allowedEnrolleeIds.has(enrolleeIdentifier)
    })

    const loginEvents: LoginEvent[] = []
    const pendingLoginIndexesByUser = new Map<string, number[]>()

    for (const log of filteredLoginLogs) {
      if (log.action === "LOGIN" || log.action === "MOBILE_LOGIN") {
        const user = userById.get(log.user_id)
        if (!user) continue
        const userType = user.provider_id ? "Provider" : "ERP Staff"
        const platform = classifyPlatform(log.user_agent)
        const event: LoginEvent = {
          userId: user.id,
          userName: `${user.first_name} ${user.last_name}`.trim(),
          userType,
          platform,
          device: extractDeviceLabel(log.user_agent),
          loginAt: log.created_at,
          status: "Success",
          failureReason: "-",
        }
        const index = loginEvents.push(event) - 1
        const queue = pendingLoginIndexesByUser.get(log.user_id) || []
        queue.push(index)
        pendingLoginIndexesByUser.set(log.user_id, queue)
      }

      if (log.action === "LOGOUT") {
        const queue = pendingLoginIndexesByUser.get(log.user_id) || []
        if (queue.length > 0) {
          const index = queue.shift()!
          const event = loginEvents[index]
          if (event) {
            event.logoutAt = log.created_at
            event.sessionMs = Math.max(0, log.created_at.getTime() - event.loginAt.getTime())
          }
          pendingLoginIndexesByUser.set(log.user_id, queue)
        }
      }
    }

    const otpRequestEventSuccess = countStatisticsEvents("otp_request", "success")
    const otpRequestEventFailed = countStatisticsEvents("otp_request", "failed")
    const otpVerifyEventSuccess = countStatisticsEvents("otp_verify", "success")
    const otpVerifyEventFailed = countStatisticsEvents("otp_verify", "failed")
    const enrolleeLoginEventSuccess = countStatisticsEvents("enrollee_login", "success")
    const enrolleeLoginEventFailed = countStatisticsEvents("enrollee_login", "failed")

    const otpRequestedCount =
      otpRequestEventSuccess + otpRequestEventFailed > 0
        ? otpRequestEventSuccess + otpRequestEventFailed
        : filteredOtpLogs.length
    const otpUsedCount = otpVerifyEventSuccess > 0 ? otpVerifyEventSuccess : filteredOtpLogs.filter((otp) => otp.used).length
    const otpFailedCount =
      otpRequestEventSuccess + otpRequestEventFailed > 0
        ? Math.max(otpVerifyEventFailed, otpRequestedCount - otpUsedCount)
        : Math.max(0, otpRequestedCount - otpUsedCount)

    const enrolleeLoginSuccessCount = enrolleeLoginEventSuccess > 0 ? enrolleeLoginEventSuccess : otpUsedCount
    const loginAttempts = loginEvents.length + otpRequestedCount + enrolleeLoginEventFailed
    const loginSuccess = loginEvents.length + enrolleeLoginSuccessCount
    const loginFailed = Math.max(0, loginAttempts - loginSuccess)

    const sessionDurations = loginEvents
      .map((event) => event.sessionMs || 0)
      .filter((value) => value > 0)

    const averageSessionMs = Math.round(average(sessionDurations))

    const erpUsers = users.filter((user) => !user.provider_id && user.status === "ACTIVE")
    const providerUsers = users.filter((user) => !!user.provider_id && user.status === "ACTIVE")

    const erpUsersInScope = erpUsers.filter((user) => allowedUserIds.has(user.id))
    const providerUsersInScope = providerUsers.filter((user) => {
      if (!user.provider_id) return false
      if (regionFilter === "all") return true
      return allowedProviderIds.has(user.provider_id)
    })

    const erpUsersLoggedInPeriod = erpUsersInScope.filter((user) => {
      if (!user.last_login_at) return false
      return user.last_login_at >= startDate && user.last_login_at <= endDate
    }).length

    const providerUsersLoggedInPeriod = providerUsersInScope.filter((user) => {
      if (!user.last_login_at) return false
      return user.last_login_at >= startDate && user.last_login_at <= endDate
    }).length

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const erpInactiveUsers = erpUsersInScope.filter((user) => !user.last_login_at || user.last_login_at < thirtyDaysAgo).length

    const moduleCounts: Record<string, number> = {
      claims: 0,
      provider: 0,
      underwriting: 0,
      callcentre: 0,
      telemedicine: 0,
      finance: 0,
      hr: 0,
      enrolleeapp: 0,
      other: 0,
    }

    const userModuleCounts = new Map<string, Record<string, number>>()
    const userActionCounts = new Map<string, number>()

    for (const log of filteredModuleLogs) {
      const moduleKey = resourceToModuleKey(log.resource)
      moduleCounts[moduleKey] = (moduleCounts[moduleKey] || 0) + 1

      const currentActions = userActionCounts.get(log.user_id) || 0
      userActionCounts.set(log.user_id, currentActions + 1)

      const perUserModules = userModuleCounts.get(log.user_id) || {}
      perUserModules[moduleKey] = (perUserModules[moduleKey] || 0) + 1
      userModuleCounts.set(log.user_id, perUserModules)
    }

    for (const event of scopedStatisticsEvents) {
      if (event.outcome !== "success") continue
      const moduleKey = statisticsEventToModuleKey(event)
      moduleCounts[moduleKey] = (moduleCounts[moduleKey] || 0) + 1
    }

    const mostUsedModuleKey = Object.entries(moduleCounts)
      .filter(([key]) => key !== "other")
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "claims"

    const mostUsedModuleLabel = MODULE_LABELS[mostUsedModuleKey] || "Claims"

    const recentDayKeys = buildDayKeys(7)
    const activeUsersPerDay = new Map<string, Set<string>>()
    const sessionsPerDay = new Map<string, number>()
    const failedPerDay = new Map<string, number>()
    const modulePerDay = new Map<string, Record<string, number>>()
    const featurePerDay = new Map<string, Partial<Record<DailyFeatureKey, number>>>()
    const avgSessionPerDay = new Map<string, number[]>()

    for (const dayKey of recentDayKeys) {
      activeUsersPerDay.set(dayKey, new Set())
      sessionsPerDay.set(dayKey, 0)
      failedPerDay.set(dayKey, 0)
      modulePerDay.set(dayKey, {})
      featurePerDay.set(dayKey, {})
      avgSessionPerDay.set(dayKey, [])
    }

    for (const event of loginEvents) {
      const dayKey = formatDateLabel(event.loginAt)
      if (!activeUsersPerDay.has(dayKey)) continue
      activeUsersPerDay.get(dayKey)!.add(event.userId)
      sessionsPerDay.set(dayKey, (sessionsPerDay.get(dayKey) || 0) + 1)
      if (event.sessionMs && event.sessionMs > 0) {
        avgSessionPerDay.get(dayKey)!.push(event.sessionMs)
      }
    }

    const hasEventBackedOtp = otpRequestEventSuccess + otpRequestEventFailed + otpVerifyEventSuccess + otpVerifyEventFailed > 0
    for (const otp of filteredOtpLogs) {
      if (hasEventBackedOtp) continue
      const dayKey = formatDateLabel(otp.created_at)
      if (!activeUsersPerDay.has(dayKey)) continue
      if (otp.used) {
        activeUsersPerDay.get(dayKey)!.add(`enrollee:${otp.enrollee_id}`)
      } else {
        failedPerDay.set(dayKey, (failedPerDay.get(dayKey) || 0) + 1)
      }
      sessionsPerDay.set(dayKey, (sessionsPerDay.get(dayKey) || 0) + 1)
    }

    for (const log of filteredModuleLogs) {
      const dayKey = formatDateLabel(log.created_at)
      if (!modulePerDay.has(dayKey)) continue
      const moduleKey = resourceToModuleKey(log.resource)
      const dayModules = modulePerDay.get(dayKey)!
      dayModules[moduleKey] = (dayModules[moduleKey] || 0) + 1
    }

    for (const event of scopedStatisticsEvents) {
      const dayKey = formatDateLabel(event.createdAt)
      if (!activeUsersPerDay.has(dayKey)) continue

      if (event.actorType === "enrollee" && (event.enrolleeId || event.actorId)) {
        activeUsersPerDay.get(dayKey)!.add(`enrollee:${event.enrolleeId || event.actorId}`)
      }

      if (event.name === "enrollee_login" && event.outcome === "success") {
        sessionsPerDay.set(dayKey, (sessionsPerDay.get(dayKey) || 0) + 1)
      }

      if (event.outcome === "failed") {
        failedPerDay.set(dayKey, (failedPerDay.get(dayKey) || 0) + 1)
      }

      if (event.outcome === "success") {
        const moduleKey = statisticsEventToModuleKey(event)
        const dayModules = modulePerDay.get(dayKey)!
        dayModules[moduleKey] = (dayModules[moduleKey] || 0) + 1

        const featureKey = statisticsEventToFeatureKey(event.name)
        if (featureKey) {
          const dayFeatures = featurePerDay.get(dayKey)!
          dayFeatures[featureKey] = (dayFeatures[featureKey] || 0) + 1
        }
      }
    }

    for (const claim of filteredClaims) {
      if (claim.status === "REJECTED") {
        const dayKey = formatDateLabel(claim.created_at)
        failedPerDay.set(dayKey, (failedPerDay.get(dayKey) || 0) + 1)
      }
    }

    for (const requestRow of filteredProviderRequests) {
      if (requestRow.status === "REJECTED") {
        const dayKey = formatDateLabel(requestRow.created_at)
        failedPerDay.set(dayKey, (failedPerDay.get(dayKey) || 0) + 1)
      }
    }

    const activeUsersTrend = recentDayKeys.map((key) => activeUsersPerDay.get(key)?.size || 0)
    const dailyTrend = activeUsersTrend
    const dailySessions = recentDayKeys.map((key) => sessionsPerDay.get(key) || 0)
    const dailyAvgSession = recentDayKeys.map((key) => formatDuration(Math.round(average(avgSessionPerDay.get(key) || []))))
    const dailyFailedActions = recentDayKeys.map((key) => failedPerDay.get(key) || 0)

    const dailyCompletedRequests = recentDayKeys.map((dayKey) => {
      const completedClaims = filteredClaims.filter(
        (claim) =>
          formatDateLabel(claim.created_at) === dayKey &&
          (claim.status === "APPROVED" || claim.status === "PAID" || claim.status === "AUDIT_COMPLETED" || claim.status === "VETTER2_COMPLETED")
      ).length
      const completedProviderRequests = filteredProviderRequests.filter(
        (row) => formatDateLabel(row.created_at) === dayKey && (row.status === "APPROVED" || row.status === "PARTIAL")
      ).length
      const completedAppointments = filteredAppointments.filter(
        (appointment) => formatDateLabel(appointment.created_at) === dayKey && appointment.status === "COMPLETED"
      ).length
      return completedClaims + completedProviderRequests + completedAppointments
    })

    const moduleUsage = [
      moduleCounts.claims,
      moduleCounts.provider,
      moduleCounts.underwriting,
      moduleCounts.callcentre,
      moduleCounts.telemedicine,
      moduleCounts.finance,
    ]

    const hourlyBuckets = [0, 0, 0, 0, 0, 0, 0]
    for (const event of loginEvents) {
      const hourLabel = new Intl.DateTimeFormat("en-NG", {
        hour: "numeric",
        hour12: false,
        timeZone: "Africa/Lagos",
      }).format(event.loginAt)
      const hour = Number(hourLabel)
      if (hour >= 6 && hour < 8) hourlyBuckets[0] += 1
      else if (hour >= 8 && hour < 10) hourlyBuckets[1] += 1
      else if (hour >= 10 && hour < 12) hourlyBuckets[2] += 1
      else if (hour >= 12 && hour < 14) hourlyBuckets[3] += 1
      else if (hour >= 14 && hour < 16) hourlyBuckets[4] += 1
      else if (hour >= 16 && hour < 18) hourlyBuckets[5] += 1
      else if (hour >= 18 && hour < 20) hourlyBuckets[6] += 1
    }
    for (const event of scopedStatisticsEvents) {
      if (event.name !== "enrollee_login" || event.outcome !== "success") continue
      const hourLabel = new Intl.DateTimeFormat("en-NG", {
        hour: "numeric",
        hour12: false,
        timeZone: "Africa/Lagos",
      }).format(event.createdAt)
      const hour = Number(hourLabel)
      if (hour >= 6 && hour < 8) hourlyBuckets[0] += 1
      else if (hour >= 8 && hour < 10) hourlyBuckets[1] += 1
      else if (hour >= 10 && hour < 12) hourlyBuckets[2] += 1
      else if (hour >= 12 && hour < 14) hourlyBuckets[3] += 1
      else if (hour >= 14 && hour < 16) hourlyBuckets[4] += 1
      else if (hour >= 16 && hour < 18) hourlyBuckets[5] += 1
      else if (hour >= 18 && hour < 20) hourlyBuckets[6] += 1
    }

    const erpModuleChart = ["claims", "underwriting", "finance", "callcentre", "telemedicine", "hr"].map((key) => {
      const count = filteredModuleLogs.filter((log) => {
        if (!erpUsersInScope.some((user) => user.id === log.user_id)) return false
        return resourceToModuleKey(log.resource) === key
      }).length
      return count
    })

    const loginCountByUser = new Map<string, number>()
    for (const event of loginEvents) {
      loginCountByUser.set(event.userId, (loginCountByUser.get(event.userId) || 0) + 1)
    }

    const erpTable = erpUsersInScope
      .map((user) => {
        const actions = userActionCounts.get(user.id) || 0
        const perUserModules = userModuleCounts.get(user.id) || {}
        const topModule = Object.entries(perUserModules).sort((a, b) => b[1] - a[1])[0]?.[0] || "claims"
        const status =
          user.status === "ACTIVE" && user.last_login_at && user.last_login_at >= thirtyDaysAgo ? "Active" : "Inactive"
        return [
          `${user.first_name} ${user.last_name}`.trim(),
          user.role?.name?.replace(/_/g, " ") || "-",
          user.department?.name || "-",
          user.last_login_at ? formatRelativeDateTime(user.last_login_at) : "-",
          loginCountByUser.get(user.id) || 0,
          MODULE_LABELS[topModule] || "General",
          actions,
          status,
        ] as Array<string | number>
      })
      .sort((a, b) => Number(b[6]) - Number(a[6]))
      .slice(0, 10)

    const providerLoginCount = new Map<string, number>()
    const providerSessionDurations = new Map<string, number[]>()
    const providerLastLogin = new Map<string, Date>()

    for (const event of loginEvents) {
      const user = userById.get(event.userId)
      if (!user?.provider_id) continue
      const providerId = user.provider_id
      providerLoginCount.set(providerId, (providerLoginCount.get(providerId) || 0) + 1)
      const currentLast = providerLastLogin.get(providerId)
      if (!currentLast || event.loginAt > currentLast) {
        providerLastLogin.set(providerId, event.loginAt)
      }
      if (event.sessionMs && event.sessionMs > 0) {
        const durations = providerSessionDurations.get(providerId) || []
        durations.push(event.sessionMs)
        providerSessionDurations.set(providerId, durations)
      }
    }

    const approvalByProvider = new Map<string, number>()
    for (const code of filteredApprovalCodes) {
      if (!code.provider_id) continue
      approvalByProvider.set(code.provider_id, (approvalByProvider.get(code.provider_id) || 0) + 1)
    }

    const claimsByProvider = new Map<string, number>()
    for (const claim of filteredClaims) {
      if (!claim.provider_id) continue
      claimsByProvider.set(claim.provider_id, (claimsByProvider.get(claim.provider_id) || 0) + 1)
    }

    const requestsByProvider = new Map<string, number>()
    for (const requestRow of filteredProviderRequests) {
      requestsByProvider.set(requestRow.provider_id, (requestsByProvider.get(requestRow.provider_id) || 0) + 1)
    }

    const providerActionChart = [
      filteredApprovalCodes.length,
      filteredClaims.length,
      filteredProviderRequests.length,
      filteredModuleLogs.filter((log) => resourceToModuleKey(log.resource) === "provider").length,
    ]

    const providerRows = providers
      .filter((provider) => regionFilter === "all" || allowedProviderIds.has(provider.id))
      .map((provider) => {
        const loginCount = providerLoginCount.get(provider.id) || 0
        const approvalCount = approvalByProvider.get(provider.id) || 0
        const claimCount = claimsByProvider.get(provider.id) || 0
        const requestCount = requestsByProvider.get(provider.id) || 0
        const sessionAvg = average(providerSessionDurations.get(provider.id) || [])
        const score = loginCount + approvalCount + claimCount + requestCount
        return {
          score,
          row: [
            provider.facility_name,
            resolveRegionFromAddress(provider.address)?.replace("south", "South ").replace("north", "North") || "-",
            providerLastLogin.get(provider.id) ? formatRelativeDateTime(providerLastLogin.get(provider.id)!) : "-",
            loginCount,
            approvalCount,
            claimCount,
            requestCount,
            formatDuration(Math.round(sessionAvg)),
          ] as Array<string | number>,
        }
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((entry) => entry.row)

    const otpByEnrollee = new Map<string, { count: number; used: number; latest: Date }>()
    const enrolleeFeatureById = new Map<string, Partial<Record<DailyFeatureKey, number>>>()
    const enrolleePlatformDevice = new Map<string, { platform: "Android" | "iOS" | "Web"; device: string }>()

    for (const otp of filteredOtpLogs) {
      const existing = otpByEnrollee.get(otp.enrollee_id)
      if (!existing) {
        otpByEnrollee.set(otp.enrollee_id, {
          count: 1,
          used: otp.used ? 1 : 0,
          latest: otp.created_at,
        })
      } else {
        existing.count += 1
        if (otp.used) existing.used += 1
        if (otp.created_at > existing.latest) existing.latest = otp.created_at
      }
    }

    for (const event of scopedStatisticsEvents) {
      if (event.actorType !== "enrollee") continue
      const enrolleeId = event.enrolleeId || event.actorId
      if (!enrolleeId) continue

      const existing = otpByEnrollee.get(enrolleeId)
      if (!existing) {
        otpByEnrollee.set(enrolleeId, {
          count: event.name === "otp_request" || (event.name === "enrollee_login" && event.outcome === "success") ? 1 : 0,
          used: event.name === "otp_verify" && event.outcome === "success" ? 1 : 0,
          latest: event.createdAt,
        })
      } else {
        if (event.name === "otp_request" || (event.name === "enrollee_login" && event.outcome === "success")) existing.count += 1
        if (event.name === "otp_verify" && event.outcome === "success") existing.used += 1
        if (event.createdAt > existing.latest) existing.latest = event.createdAt
      }

      if (event.outcome === "success") {
        const featureKey = statisticsEventToFeatureKey(event.name)
        if (featureKey) {
          const current = enrolleeFeatureById.get(enrolleeId) || {}
          current[featureKey] = (current[featureKey] || 0) + 1
          enrolleeFeatureById.set(enrolleeId, current)
        }
      }

      enrolleePlatformDevice.set(enrolleeId, {
        platform: event.platform,
        device: extractDeviceLabel(event.userAgent),
      })
    }

    const providerRequestsByEnrollee = new Map<string, number>()
    for (const row of filteredProviderRequests) {
      providerRequestsByEnrollee.set(row.enrollee_id, (providerRequestsByEnrollee.get(row.enrollee_id) || 0) + 1)
    }

    const appointmentsByEnrollee = new Map<string, number>()
    for (const appointment of filteredAppointments) {
      const enrolleeId = principalIdToEnrolleeId.get(appointment.enrollee_id)
      if (!enrolleeId) continue
      appointmentsByEnrollee.set(enrolleeId, (appointmentsByEnrollee.get(enrolleeId) || 0) + 1)
    }

    const enrolleeRows = Array.from(otpByEnrollee.entries())
      .map(([enrolleeId, stats]) => {
        const principal = principalByEnrollee.get(enrolleeId)
        const dependent = dependentById.get(enrolleeId)
        const name = principal?.name || dependent?.name || "Unknown Enrollee"
        const state = principal?.state || dependent?.state || "-"
        const providerRequestsCount = providerRequestsByEnrollee.get(enrolleeId) || 0
        const telemedicineCount = appointmentsByEnrollee.get(enrolleeId) || 0
        const featureCounts = enrolleeFeatureById.get(enrolleeId) || {}
        const topFeatureKey =
          Object.entries(featureCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] as DailyFeatureKey | undefined

        let mostUsedFeature = topFeatureKey ? DAILY_FEATURE_LABELS[topFeatureKey] : "App Login"
        if (!topFeatureKey) {
          if (providerRequestsCount >= telemedicineCount && providerRequestsCount > 0) {
            mostUsedFeature = "Approval Codes"
          } else if (telemedicineCount > 0) {
            mostUsedFeature = "Telemedicine"
          }
        }

        const platformDevice = enrolleePlatformDevice.get(enrolleeId)
        return {
          score: stats.count + stats.used + providerRequestsCount + telemedicineCount,
          row: [
            name,
            enrolleeId,
            platformDevice?.platform || "Mobile",
            platformDevice?.device || "-",
            formatRelativeDateTime(stats.latest),
            stats.count,
            mostUsedFeature,
            "-",
            state || "-",
          ] as Array<string | number>,
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((entry) => entry.row)

    const chatCountFromLogs = filteredModuleLogs.filter((log) => log.action.toUpperCase().includes("CHAT")).length
    const featureUsageCounts = {
      providerSearch: countFeatureEvents("providerSearch"),
      benefits: countFeatureEvents("benefits"),
      telemedicine: countFeatureEvents("telemedicine"),
      chat: countFeatureEvents("chat"),
      claims: countFeatureEvents("claims"),
      profile: countFeatureEvents("profile"),
    }
    const hasTrackedFeatureUsage = Object.values(featureUsageCounts).some((count) => count > 0)

    const enrolleeFeatureChart = hasTrackedFeatureUsage
      ? [
          featureUsageCounts.benefits,
          featureUsageCounts.providerSearch,
          featureUsageCounts.telemedicine,
          featureUsageCounts.chat,
          featureUsageCounts.claims,
          featureUsageCounts.profile,
        ]
      : [
          Math.max(0, filteredApprovalCodes.length),
          filteredProviderRequests.length,
          filteredAppointments.length,
          chatCountFromLogs,
          Math.max(0, filteredClaims.length),
          filteredOtpLogs.filter((otp) => otp.used).length,
        ]

    const mobileAuthEventRows = scopedStatisticsEvents
      .filter((event) => event.actorType === "enrollee")
      .filter((event) => event.name === "otp_request" || event.name === "otp_verify" || event.name === "enrollee_login")
      .map((event) => {
        const enrolleeId = event.enrolleeId || event.actorId || "-"
        const principal = principalByEnrollee.get(enrolleeId)
        const dependent = dependentById.get(enrolleeId)
        const name = principal?.name || dependent?.name || enrolleeId
        const status = event.outcome === "failed" ? "Failed" : "Success"
        const failureReason =
          event.outcome === "failed" ? String(event.metadata.reason || "Request failed") : "-"
        return {
          ts: event.createdAt.getTime(),
          row: [
            name,
            "Enrollee",
            event.platform,
            extractDeviceLabel(event.userAgent),
            formatRelativeDateTime(event.createdAt),
            "-",
            "-",
            status,
            failureReason,
          ] as Array<string | number>,
        }
      })

    const fallbackOtpRows = filteredOtpLogs.map((otp) => {
      const principal = principalByEnrollee.get(otp.enrollee_id)
      const dependent = dependentById.get(otp.enrollee_id)
      const name = principal?.name || dependent?.name || otp.enrollee_id
      return {
        ts: otp.created_at.getTime(),
        row: [
          name,
          "Enrollee",
          "Mobile",
          "-",
          formatRelativeDateTime(otp.created_at),
          "-",
          "-",
          otp.used ? "Success" : "Failed",
          otp.used ? "-" : "OTP not verified",
        ] as Array<string | number>,
      }
    })

    const allLoginRows = [
      ...loginEvents.map((event) => ({
        ts: event.loginAt.getTime(),
        row: [
          event.userName,
          event.userType,
          event.platform,
          event.device,
          formatRelativeDateTime(event.loginAt),
          event.logoutAt ? formatRelativeDateTime(event.logoutAt) : "-",
          formatDuration(event.sessionMs),
          event.status,
          event.failureReason,
        ] as Array<string | number>,
      })),
      ...(mobileAuthEventRows.length > 0 ? mobileAuthEventRows : fallbackOtpRows),
    ]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 12)
      .map((entry) => entry.row)

    const otpDropoffRate = percent(otpFailedCount, otpRequestedCount || 1)
    const completedAppointments = filteredAppointments.filter((appointment) => appointment.status === "COMPLETED").length
    const telemedicineBookingStarted =
      countStatisticsEvents("telemedicine_booking_create", "success") + countStatisticsEvents("telemedicine_booking_create", "failed")
    const telemedicineBookingCompleted = countStatisticsEvents("telemedicine_booking_create", "success")
    const telemedicineStartedCount = telemedicineBookingStarted > 0 ? telemedicineBookingStarted : filteredAppointments.length
    const telemedicineCompletedCount = telemedicineBookingStarted > 0 ? telemedicineBookingCompleted : completedAppointments
    const appointmentDropRate = percent(
      telemedicineStartedCount - telemedicineCompletedCount,
      telemedicineStartedCount || 1
    )

    const approvedProviderRequests = filteredProviderRequests.filter(
      (row) => row.status === "APPROVED" || row.status === "PARTIAL"
    ).length
    const encounterRequestStarted =
      countStatisticsEvents("encounter_request_submit", "success") + countStatisticsEvents("encounter_request_submit", "failed")
    const encounterRequestCompleted = countStatisticsEvents("encounter_request_submit", "success")
    const approvalRequestStartedCount = encounterRequestStarted > 0 ? encounterRequestStarted : filteredProviderRequests.length
    const approvalRequestCompletedCount = encounterRequestStarted > 0 ? encounterRequestCompleted : approvedProviderRequests
    const providerRequestDropRate = percent(
      approvalRequestStartedCount - approvalRequestCompletedCount,
      approvalRequestStartedCount || 1
    )

    const approvedClaims = filteredClaims.filter(
      (claim) => claim.status === "APPROVED" || claim.status === "PAID" || claim.status === "AUDIT_COMPLETED" || claim.status === "VETTER2_COMPLETED"
    ).length
    const claimSubmissionStarted = countStatisticsEvents("claims_view", "success") + countStatisticsEvents("claims_view", "failed")
    const claimSubmissionCompleted = countStatisticsEvents("claims_view", "success")
    const claimStartedCount = claimSubmissionStarted > 0 ? claimSubmissionStarted : filteredClaims.length
    const claimCompletedCount = claimSubmissionStarted > 0 ? claimSubmissionCompleted : approvedClaims
    const claimDropRate = percent(claimStartedCount - claimCompletedCount, claimStartedCount || 1)

    const dropoffRows = [
      ["OTP Login Process", otpRequestedCount, otpUsedCount, otpFailedCount, `${otpDropoffRate}%`, "OTP Verification Screen"],
      [
        "Telemedicine Booking",
        telemedicineStartedCount,
        telemedicineCompletedCount,
        Math.max(0, telemedicineStartedCount - telemedicineCompletedCount),
        `${appointmentDropRate}%`,
        "Appointment Completion",
      ],
      [
        "Approval Code Request",
        approvalRequestStartedCount,
        approvalRequestCompletedCount,
        Math.max(0, approvalRequestStartedCount - approvalRequestCompletedCount),
        `${providerRequestDropRate}%`,
        "Approval Processing",
      ],
      [
        "Claims Submission",
        claimStartedCount,
        claimCompletedCount,
        Math.max(0, claimStartedCount - claimCompletedCount),
        `${claimDropRate}%`,
        "Claims Review",
      ],
    ]

    const highestDropoff = [...dropoffRows].sort((a, b) => Number(String(b[4]).replace("%", "")) - Number(String(a[4]).replace("%", "")))[0]
    const overallDropRate = Math.round(average([otpDropoffRate, appointmentDropRate, providerRequestDropRate, claimDropRate]))

    const providerDistinctLogins = new Set(loginEvents.filter((event) => event.userType === "Provider").map((event) => event.userId)).size

    const enrolleeFunnelBase = Math.max(otpRequestedCount, 1)
    const enrolleeFunnelSteps: [string, number][] = [
      ["App Opened", 100],
      ["Login Started", percent(otpRequestedCount, enrolleeFunnelBase)],
      ["OTP Requested", percent(otpRequestedCount, enrolleeFunnelBase)],
      ["OTP Verified", percent(otpUsedCount, enrolleeFunnelBase)],
      ["Dashboard Reached", percent(otpUsedCount, enrolleeFunnelBase)],
      [
        "Action Completed",
        percent(
          telemedicineCompletedCount +
            approvalRequestCompletedCount +
            claimCompletedCount +
            countStatisticsEvents("provider_search", "success") +
            countStatisticsEvents("coverage_view", "success"),
          enrolleeFunnelBase
        ),
      ],
    ]

    const providerFunnelBase = Math.max(providerDistinctLogins, 1)
    const providerFunnelSteps: [string, number][] = [
      ["Portal Login", 100],
      ["Dashboard Reached", percent(providerDistinctLogins, providerFunnelBase)],
      ["Approval Code Started", Math.min(100, percent(filteredProviderRequests.length, providerFunnelBase))],
      ["Services Added", Math.min(100, percent(filteredApprovalCodes.length, providerFunnelBase))],
      ["Submitted Successfully", Math.min(100, percent(approvedProviderRequests, providerFunnelBase))],
    ]

    const dashboardVisitCount =
      filteredModuleLogs.filter((log) => log.resource.toLowerCase().includes("dashboard")).length +
      countStatisticsEvents("enrollee_login", "success")
    const providerSearchCount = featureUsageCounts.providerSearch > 0 ? featureUsageCounts.providerSearch : filteredProviderRequests.length
    const benefitsCount = featureUsageCounts.benefits > 0 ? featureUsageCounts.benefits : filteredApprovalCodes.length
    const telemedicineCount = featureUsageCounts.telemedicine > 0 ? featureUsageCounts.telemedicine : filteredAppointments.length
    const chatCount = featureUsageCounts.chat > 0 ? featureUsageCounts.chat : chatCountFromLogs
    const claimsFeatureCount = featureUsageCounts.claims > 0 ? featureUsageCounts.claims : filteredClaims.length
    const profileFeatureCount = featureUsageCounts.profile > 0 ? featureUsageCounts.profile : otpUsedCount

    const moduleDistribution = [
      providerSearchCount,
      benefitsCount,
      telemedicineCount,
      chatCount,
      claimsFeatureCount,
      profileFeatureCount,
    ]

    const mobileDeviceEvents: Array<{
      platform: "Android" | "iOS"
      userId: string
      userAgent: string | null
      sessionMs?: number
      isError: boolean
      createdAt: Date
    }> = []

    for (const event of scopedStatisticsEvents) {
      if (event.platform === "Web") continue
      const mobileUserId = event.enrolleeId || event.actorId || `${event.name}:${event.createdAt.toISOString()}`
      mobileDeviceEvents.push({
        platform: event.platform,
        userId: mobileUserId,
        userAgent: event.userAgent,
        isError: event.outcome === "failed",
        createdAt: event.createdAt,
      })
    }

    for (const event of loginEvents) {
      if (event.platform === "Web") continue
      const ua = filteredLoginLogs.find((row) => row.user_id === event.userId && row.created_at.getTime() === event.loginAt.getTime())?.user_agent || null
      mobileDeviceEvents.push({
        platform: event.platform,
        userId: event.userId,
        userAgent: ua,
        sessionMs: event.sessionMs,
        isError: false,
        createdAt: event.loginAt,
      })
    }

    const topMobileVersions = new Map<string, number>()
    for (const event of mobileDeviceEvents) {
      if (event.isError) continue
      const version = extractAppVersion(event.userAgent)
      topMobileVersions.set(version, (topMobileVersions.get(version) || 0) + 1)
    }

    const versionEntries = Array.from(topMobileVersions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)

    while (versionEntries.length < 4) {
      versionEntries.push([`v${versionEntries.length + 1}.x`, 0])
    }

    const versionLabels = versionEntries.map(([version]) => version)
    const versionChart = versionEntries.map(([, count]) => count)

    const groupedDeviceRows = new Map<
      string,
      {
        platform: string
        device: string
        version: string
        os: string
        users: Set<string>
        errors: number
        sessions: number[]
      }
    >()

    for (const event of mobileDeviceEvents) {
      const platform = event.platform
      const deviceLabel = extractDeviceLabel(event.userAgent)
      const version = extractAppVersion(event.userAgent)
      const os = extractOsVersion(event.userAgent)
      const key = `${platform}|${deviceLabel}|${version}|${os}`
      if (!groupedDeviceRows.has(key)) {
        groupedDeviceRows.set(key, {
          platform,
          device: deviceLabel,
          version,
          os,
          users: new Set<string>(),
          errors: 0,
          sessions: [],
        })
      }
      const row = groupedDeviceRows.get(key)!
      row.users.add(event.userId)
      if (event.isError) row.errors += 1
      if (event.sessionMs && event.sessionMs > 0) row.sessions.push(event.sessionMs)
    }

    const deviceTable = Array.from(groupedDeviceRows.values())
      .sort((a, b) => b.users.size - a.users.size)
      .slice(0, 10)
      .map((row) => [
        row.platform,
        row.device,
        row.version,
        row.os,
        row.users.size,
        row.errors,
        formatDuration(Math.round(average(row.sessions))),
      ])

    const androidUserCount = new Set(mobileDeviceEvents.filter((event) => event.platform === "Android").map((event) => event.userId)).size
    const iosUserCount = new Set(mobileDeviceEvents.filter((event) => event.platform === "iOS").map((event) => event.userId)).size
    const androidErrorCount = mobileDeviceEvents.filter((event) => event.platform === "Android" && event.isError).length
    const iosErrorCount = mobileDeviceEvents.filter((event) => event.platform === "iOS" && event.isError).length

    const loginHours = [...loginEvents.map((event) => event.loginAt), ...mobileDeviceEvents.map((event) => event.createdAt)].map((dateValue) => {
      return Number(
        new Intl.DateTimeFormat("en-NG", {
          hour: "numeric",
          hour12: false,
          timeZone: "Africa/Lagos",
        }).format(dateValue)
      )
    })
    const peakHour = loginHours.length > 0 ? Math.round(average(loginHours)) : 9
    const peakWindow = `${Math.max(0, peakHour - 1)}:00 - ${Math.min(23, peakHour + 1)}:00`

    const regionRows = (regionFilter === "all" ? (["southwest", "north", "southsouth", "southeast"] as RegionFilter[]) : [regionFilter])
      .map((regionKey) => {
        if (regionKey === "all") return null

        const erpUsersByRegion = users.filter((user) => !user.provider_id && userRegionById.get(user.id) === regionKey).length
        const providerUsersByRegion = users.filter((user) => user.provider_id && userRegionById.get(user.id) === regionKey).length
        const regionEnrolleeEvents = scopedStatisticsEvents.filter((event) => {
          if (event.actorType !== "enrollee") return false
          const enrolleeId = event.enrolleeId || event.actorId
          if (!enrolleeId) return false
          return resolveEnrolleeRegion(enrolleeId) === regionKey
        })

        const appUsersByRegion = (() => {
          const eventUsers = new Set(
            regionEnrolleeEvents
              .filter((event) => event.name === "enrollee_login" && event.outcome === "success")
              .map((event) => event.enrolleeId || event.actorId)
              .filter(Boolean) as string[]
          )
          if (eventUsers.size > 0) return eventUsers.size
          return new Set(
            filteredOtpLogs
              .filter((otp) => resolveEnrolleeRegion(otp.enrollee_id) === regionKey && otp.used)
              .map((otp) => otp.enrollee_id)
          ).size
        })()
        const regionLogins = loginEvents.filter((event) => userRegionById.get(event.userId) === regionKey).length
        const regionOtpStartedEvents = regionEnrolleeEvents.filter((event) => event.name === "otp_request")
        const regionOtpCompletedEvents = regionEnrolleeEvents.filter(
          (event) => event.name === "otp_verify" && event.outcome === "success"
        )
        const regionOtpStarted = filteredOtpLogs.filter((otp) => resolveEnrolleeRegion(otp.enrollee_id) === regionKey)
        const regionOtpCompleted = regionOtpStarted.filter((otp) => otp.used).length
        const otpStartedCount = regionOtpStartedEvents.length > 0 ? regionOtpStartedEvents.length : regionOtpStarted.length
        const otpCompletedCount = regionOtpCompletedEvents.length > 0 ? regionOtpCompletedEvents.length : regionOtpCompleted
        const dropoff = percent(otpStartedCount - otpCompletedCount, otpStartedCount || 1)

        const regionUserIds = users
          .filter((user) => userRegionById.get(user.id) === regionKey)
          .map((user) => user.id)
        const regionModuleCounts: Record<string, number> = {}
        filteredModuleLogs.forEach((log) => {
          if (!regionUserIds.includes(log.user_id)) return
          const moduleKey = resourceToModuleKey(log.resource)
          regionModuleCounts[moduleKey] = (regionModuleCounts[moduleKey] || 0) + 1
        })
        regionEnrolleeEvents.forEach((event) => {
          if (event.outcome !== "success") return
          const moduleKey = statisticsEventToModuleKey(event)
          regionModuleCounts[moduleKey] = (regionModuleCounts[moduleKey] || 0) + 1
        })
        const topRegionModule = Object.entries(regionModuleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "claims"

        const regionLabelMap: Record<string, string> = {
          southwest: "South West",
          north: "North",
          southsouth: "South South",
          southeast: "South East",
        }
        return [
          regionLabelMap[regionKey],
          erpUsersByRegion,
          providerUsersByRegion,
          appUsersByRegion,
          regionLogins + otpCompletedCount,
          `${dropoff}%`,
          MODULE_LABELS[topRegionModule] || toFeatureName(topRegionModule),
        ]
      })
      .filter(Boolean) as Array<Array<string | number>>

    const mainInsightFeature = toFeatureName(mostUsedModuleKey)
    const mostActiveRegion = regionRows.sort((a, b) => Number(b[4]) - Number(a[4]))[0]?.[0] || "South West"
    const fallbackEnrolleeLoggedInUsers = new Set(filteredOtpLogs.filter((otp) => otp.used).map((otp) => otp.enrollee_id)).size
    const enrolleeLoggedInUsers =
      countUniqueEnrolleeEvents(["enrollee_login"], "success") || countUniqueEnrolleeEvents(["otp_verify"], "success") || fallbackEnrolleeLoggedInUsers

    const snapshot: StatisticsSnapshot & {
      device: StatisticsSnapshot["device"] & { versionLabels?: string[] }
    } = {
      kpis: {
        erpUsers: erpUsersLoggedInPeriod,
        providerUsers: providerUsersLoggedInPeriod,
        enrolleeUsers: enrolleeLoggedInUsers,
        totalLogins: loginSuccess,
        androidUsers: androidUserCount,
        iosUsers: iosUserCount,
        dropOff: overallDropRate,
        avgSession: formatDuration(averageSessionMs),
      },
      insights: [
        `Most used module in selected period: <strong>${mostUsedModuleLabel}</strong>`,
        `Highest drop-off point: <strong>${highestDropoff?.[0] || "OTP Login Process"}</strong>`,
        `Most active region: <strong>${String(mostActiveRegion)}</strong>`,
        `Peak login window: <strong>${peakWindow}</strong>`,
        `Most used tracked feature: <strong>${mainInsightFeature}</strong>`,
      ],
      activeUsersTrend,
      moduleUsage,
      hourlyUsage: hourlyBuckets,
      erp: {
        totalUsers: erpUsersInScope.length,
        loggedInToday: erpUsersInScope.filter((user) => user.last_login_at && user.last_login_at >= startOfDay(now)).length,
        inactiveUsers: erpInactiveUsers,
        mostUsedModule: mostUsedModuleLabel,
        moduleChart: erpModuleChart,
        table: erpTable,
      },
      provider: {
        registered: providers.filter((provider) => regionFilter === "all" || allowedProviderIds.has(provider.id)).length,
        loggedIn: new Set(loginEvents.filter((event) => event.userType === "Provider").map((event) => event.userId)).size,
        approvalCodes: filteredApprovalCodes.length,
        claims: filteredClaims.length,
        actionChart: providerActionChart,
        table: providerRows,
      },
      enrollee: {
        appUsers: enrolleeLoggedInUsers,
        newSignups: mobilePrincipalSignups + mobileDependentSignups,
        returning: Math.max(
          0,
          enrolleeLoggedInUsers - (mobilePrincipalSignups + mobileDependentSignups)
        ),
        loggedIn: enrolleeLoginSuccessCount,
        featureChart: enrolleeFeatureChart,
        table: enrolleeRows,
      },
      login: {
        attempts: loginAttempts,
        success: loginSuccess,
        failed: loginFailed,
        otp: otpRequestedCount,
        loginChart: [loginSuccess, loginFailed],
        sessionChart: dailyAvgSession.map((value) => {
          const minutes = Number(value.split("m")[0])
          return Number.isNaN(minutes) ? 0 : minutes
        }),
        table: allLoginRows,
      },
      dropoff: {
        highest: String(highestDropoff?.[0] || "OTP Login Process"),
        rate: overallDropRate,
        completion: Math.max(0, 100 - overallDropRate),
        funnel: Math.max(0, 100 - overallDropRate),
        enrolleeSteps: enrolleeFunnelSteps,
        providerSteps: providerFunnelSteps,
        table: dropoffRows,
      },
      daily: {
        dashboard: dashboardVisitCount + loginEvents.length,
        providerSearch: providerSearchCount,
        telemedicine: telemedicineCount,
        chat: chatCount,
        trend: dailyTrend,
        distribution: moduleDistribution,
        table: recentDayKeys.map((dayKey, index) => {
          const dayModules = modulePerDay.get(dayKey) || {}
          const dayFeatures = featurePerDay.get(dayKey) || {}
          const topDayFeature = Object.entries(dayFeatures).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] as DailyFeatureKey | undefined
          const leastDayFeature =
            Object.entries(dayFeatures)
              .filter(([, value]) => Number(value) > 0)
              .sort((a, b) => Number(a[1]) - Number(b[1]))[0]?.[0] as DailyFeatureKey | undefined

          const topDayModule = Object.entries(dayModules).sort((a, b) => b[1] - a[1])[0]?.[0] || "claims"
          const leastDayModule =
            Object.entries(dayModules)
              .filter(([, value]) => value > 0)
              .sort((a, b) => a[1] - b[1])[0]?.[0] || "other"
          return [
            dayKey,
            activeUsersTrend[index] || 0,
            dailySessions[index] || 0,
            topDayFeature ? DAILY_FEATURE_LABELS[topDayFeature] : toFeatureName(topDayModule),
            leastDayFeature ? DAILY_FEATURE_LABELS[leastDayFeature] : toFeatureName(leastDayModule),
            dailyAvgSession[index] || "-",
            dailyCompletedRequests[index] || 0,
            dailyFailedActions[index] || 0,
          ]
        }),
      },
      device: {
        android: androidUserCount,
        ios: iosUserCount,
        androidErrors: androidErrorCount,
        iosErrors: iosErrorCount,
        platformChart: [androidUserCount, iosUserCount],
        versionChart,
        versionLabels,
        table: deviceTable,
      },
      reports: {
        summary: [
          `Active usage is strongest in <strong>${String(mostActiveRegion)}</strong>.`,
          `Most used module is currently <strong>${mostUsedModuleLabel}</strong>.`,
          `Overall drop-off across tracked funnels is <strong>${overallDropRate}%</strong>.`,
          `Average tracked session duration is <strong>${formatDuration(averageSessionMs)}</strong>.`,
        ],
        regional: regionRows,
      },
    }

    return NextResponse.json({
      data: snapshot,
      meta: {
        source: "live",
        period,
        region: regionFilter,
        platform: platformFilter,
        module: moduleFilter,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("Error generating statistics analytics:", error)
    return NextResponse.json({ error: "Failed to generate statistics analytics" }, { status: 500 })
  }
}
