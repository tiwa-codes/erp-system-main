import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyPassword, hashPassword } from "@/lib/auth-utils"
import { signMobileToken } from "@/lib/mobile-auth"
import { createAuditLog } from "@/lib/audit"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { role: true, department: true },
    })

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Account is not active. Please contact support." }, { status: 403 })
    }

    if (!user.password) {
      return NextResponse.json({ error: "Password not set. Please contact support." }, { status: 401 })
    }

    // Verify password with bcrypt backward-compat migration
    let isPasswordValid = await verifyPassword(password, user.password)
    if (!isPasswordValid) {
      const looksHashed =
        typeof user.password === "string" && user.password.startsWith("$2") && user.password.length >= 50
      if (!looksHashed && password === user.password) {
        const newHash = await hashPassword(password)
        await prisma.user.update({ where: { id: user.id }, data: { password: newHash } })
        isPasswordValid = true
      }
    }

    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    })

    // Audit log
    await createAuditLog({
      userId: user.id,
      action: "MOBILE_LOGIN",
      resource: "auth",
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      userAgent: req.headers.get("user-agent") || "unknown",
    })

    const roleName = user.role?.name || ""

    const token = await signMobileToken({
      id: user.id,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      role: roleName,
      departmentId: user.department_id,
      provider_id: user.provider_id || null,
      first_login: user.first_login,
    })

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        role: roleName,
        departmentId: user.department_id,
        department: user.department,
        provider_id: user.provider_id || null,
        first_login: user.first_login,
        profile_picture: user.profile_picture,
      },
    })
  } catch (error) {
    console.error("[MOBILE_AUTH_LOGIN]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
