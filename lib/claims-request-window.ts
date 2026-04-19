const CLAIMS_REQUEST_TIME_ZONE = "Africa/Lagos"
const ONE_DAY_MS = 24 * 60 * 60 * 1000
export const CLAIMS_REQUEST_GRACE_DAYS = 7

type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const toZonedParts = (date: Date): ZonedParts => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLAIMS_REQUEST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const map = new Map<string, number>()
  for (const part of parts) {
    if (part.type === "literal") continue
    const parsed = Number.parseInt(part.value, 10)
    if (!Number.isNaN(parsed)) {
      map.set(part.type, parsed)
    }
  }

  return {
    year: map.get("year") || 1970,
    month: map.get("month") || 1,
    day: map.get("day") || 1,
    hour: map.get("hour") || 0,
    minute: map.get("minute") || 0,
    second: map.get("second") || 0,
  }
}

const getWindowOpenMsForMonth = (year: number, month: number) => {
  // Window opens at the start of each month (1st day, 00:00 WAT).
  return Date.UTC(year, month - 1, 1, 0, 0, 0, 0)
}

export type ClaimsRequestWindowStatus = "BEFORE_WINDOW" | "OPEN" | "AFTER_WINDOW"

export function getClaimsRequestWindowMeta(nowInput?: Date) {
  const now = nowInput || new Date()
  const nowParts = toZonedParts(now)
  const nowMs = Date.UTC(
    nowParts.year,
    nowParts.month - 1,
    nowParts.day,
    nowParts.hour,
    nowParts.minute,
    nowParts.second,
    0
  )

  const openMs = getWindowOpenMsForMonth(nowParts.year, nowParts.month)
  // Keep the window open for exactly N days from opening day.
  // With CLAIMS_REQUEST_GRACE_DAYS = 7, this means 1st to 7th (inclusive).
  const closeExclusiveMs = openMs + CLAIMS_REQUEST_GRACE_DAYS * ONE_DAY_MS

  let status: ClaimsRequestWindowStatus
  if (nowMs < openMs) {
    status = "BEFORE_WINDOW"
  } else if (nowMs >= closeExclusiveMs) {
    status = "AFTER_WINDOW"
  } else {
    status = "OPEN"
  }

  let nextOpenMs = openMs
  if (status === "AFTER_WINDOW") {
    const nextMonth = nowParts.month === 12 ? 1 : nowParts.month + 1
    const nextYear = nowParts.month === 12 ? nowParts.year + 1 : nowParts.year
    nextOpenMs = getWindowOpenMsForMonth(nextYear, nextMonth)
  }

  const countdownTargetMs = status === "OPEN" ? closeExclusiveMs : nextOpenMs
  const remainingMs = Math.max(0, countdownTargetMs - nowMs)

  return {
    timeZone: CLAIMS_REQUEST_TIME_ZONE,
    status,
    isOpen: status === "OPEN",
    openAt: new Date(openMs),
    closeAt: new Date(closeExclusiveMs - 1000),
    closeAtExclusive: new Date(closeExclusiveMs),
    nextOpenAt: new Date(nextOpenMs),
    countdownTarget: new Date(countdownTargetMs),
    remainingMs,
    remainingSeconds: Math.floor(remainingMs / 1000),
  }
}

export function formatLongCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const days = Math.floor(safeSeconds / 86400)
  const hours = Math.floor((safeSeconds % 86400) / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  return `${days}d ${hours.toString().padStart(2, "0")}h ${minutes
    .toString()
    .padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`
}
