import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hashPassword, verifyPassword } from "@/lib/auth-utils"

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { current_password, new_password, confirm_password } = body

  if (!new_password || new_password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }
  if (new_password !== confirm_password) {
    return NextResponse.json({ error: "Passwords do not match" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  if (user.password) {
    const ok = await verifyPassword(current_password, user.password)
    if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
  }

  const hashed = await hashPassword(new_password)
  await prisma.user.update({ where: { id: session.user.id }, data: { password: hashed } })

  return NextResponse.json({ success: true })
}
