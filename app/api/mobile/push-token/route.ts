import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileToken } from "@/lib/mobile-auth"

export async function POST(req: NextRequest) {
  try {
    const session = await verifyMobileToken(req)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { token } = await req.json()
    if (!token) {
      return NextResponse.json({ error: "Push token is required" }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: session.id },
      data: { push_token: token },
    })

    return NextResponse.json({ message: "Push token saved" })
  } catch (error) {
    console.error("[MOBILE_PUSH_TOKEN]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
