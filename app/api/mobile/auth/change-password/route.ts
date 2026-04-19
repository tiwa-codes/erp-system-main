import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyPassword, hashPassword } from "@/lib/auth-utils"
import { verifyMobileToken, signMobileToken } from "@/lib/mobile-auth"

export async function POST(req: NextRequest) {
  try {
    const session = await verifyMobileToken(req)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { currentPassword, newPassword } = await req.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "currentPassword and newPassword are required" }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: session.id } })
    if (!user || !user.password) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const isValid = await verifyPassword(currentPassword, user.password)
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
    }

    const hashedNew = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedNew, first_login: false },
    })

    // Return a fresh token with first_login = false
    const newToken = await signMobileToken({
      id: user.id,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      role: session.role,
      departmentId: session.departmentId,
      provider_id: session.provider_id,
      first_login: false,
    })

    return NextResponse.json({ message: "Password changed successfully", token: newToken })
  } catch (error) {
    console.error("[MOBILE_CHANGE_PASSWORD]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
