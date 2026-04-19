export const ADD_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000

const toDate = (value: Date | string | null | undefined) => {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function getAddServiceWindowMeta(input: {
  createdAt: Date | string | null | undefined
  approvedAt?: Date | string | null
  now?: Date
}) {
  const fallbackCreatedAt = toDate(input.createdAt)
  const approvedAt = toDate(input.approvedAt)
  const windowStartedAt = approvedAt || fallbackCreatedAt

  if (!windowStartedAt) {
    return {
      windowStartedAt: null,
      expiresAt: null,
      isExpired: true,
      remainingMs: 0,
      remainingSeconds: 0,
    }
  }

  const now = input.now || new Date()
  const expiresAt = new Date(windowStartedAt.getTime() + ADD_SERVICE_WINDOW_MS)
  const remainingMs = Math.max(0, expiresAt.getTime() - now.getTime())

  return {
    windowStartedAt,
    expiresAt,
    isExpired: remainingMs <= 0,
    remainingMs,
    remainingSeconds: Math.floor(remainingMs / 1000),
  }
}

export function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}
