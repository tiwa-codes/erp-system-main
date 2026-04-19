import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { getClaimsRequestWindowMeta } from "@/lib/claims-request-window"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "claims", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const windowMeta = getClaimsRequestWindowMeta()

    return NextResponse.json({
      status: windowMeta.status,
      is_open: windowMeta.isOpen,
      time_zone: windowMeta.timeZone,
      open_at: windowMeta.openAt.toISOString(),
      close_at: windowMeta.closeAt.toISOString(),
      close_at_exclusive: windowMeta.closeAtExclusive.toISOString(),
      next_open_at: windowMeta.nextOpenAt.toISOString(),
      countdown_target: windowMeta.countdownTarget.toISOString(),
      remaining_seconds: windowMeta.remainingSeconds,
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch claims request window" }, { status: 500 })
  }
}
