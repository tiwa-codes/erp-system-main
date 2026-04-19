import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/auth-utils"
import { notificationService } from "@/lib/notifications"
import { OrganizationType } from "@prisma/client"

const CLIENT_ROLE_NAME = "GUEST_OR_CLIENT"

const ACCOUNT_TYPE_OPTIONS = [
  "INDIVIDUAL_OR_FAMILY",
  "FACILITATOR",
  "BROKER",
  "HUMAN_RESOURCE",
  "FINANCIAL_INSTITUTE",
] as const

type ClientAccountType = (typeof ACCOUNT_TYPE_OPTIONS)[number]

function normalizeAccountType(value: string): ClientAccountType | null {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/\//g, "_")
  return ACCOUNT_TYPE_OPTIONS.includes(normalized as ClientAccountType)
    ? (normalized as ClientAccountType)
    : null
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const first_name = parts[0] || "Client"
  const last_name = parts.slice(1).join(" ") || "User"
  return { first_name, last_name }
}

function randomCode(length: number) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let out = ""
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

function organizationTypeFor(accountType: ClientAccountType): OrganizationType {
  if (accountType === "INDIVIDUAL_OR_FAMILY") return "INDIVIDUAL"
  return "CORPORATE"
}

async function getOrCreateClientRole() {
  const existing = await prisma.role.findFirst({
    where: { name: { equals: CLIENT_ROLE_NAME, mode: "insensitive" } },
  })

  if (existing) return existing

  return prisma.role.create({
    data: {
      name: CLIENT_ROLE_NAME,
      description: "Guest/Client portal user",
      is_system: true,
      is_active: true,
      permissions: [],
    },
  })
}

async function generateUniqueOrganizationIdentity(baseName: string, db: typeof prisma = prisma) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = randomCode(4)
    const code = `CL${suffix}`
    const orgName = attempt === 0 ? `${baseName} Client` : `${baseName} Client ${suffix}`
    const organizationId = `CL${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 900 + 100)}`

    const [nameTaken, codeTaken, idTaken] = await Promise.all([
      db.organization.findFirst({ where: { name: orgName }, select: { id: true } }),
      db.organization.findFirst({ where: { code }, select: { id: true } }),
      db.organization.findFirst({ where: { organization_id: organizationId }, select: { id: true } }),
    ])

    if (!nameTaken && !codeTaken && !idTaken) {
      return { orgName, code, organizationId }
    }
  }

  throw new Error("Could not generate unique organization identity")
}

async function hasAnyExistingProfileWithEmail(email: string) {
  const [existingUser, existingPrincipal, existingRegistration] = await Promise.all([
    prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    }),
    prisma.principalAccount.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    }),
    prisma.principalRegistration.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        status: {
          in: ["PENDING", "REVIEW", "APPROVED", "PENDING_PAYMENT"],
        },
      },
      select: { id: true },
    }),
  ])

  return Boolean(existingUser || existingPrincipal || existingRegistration)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const fullName = String(body.full_name || "").trim()
    const email = String(body.email || "").trim().toLowerCase()
    const password = String(body.password || "")
    const accountType = normalizeAccountType(String(body.account_type || ""))

    if (!fullName || !email || !password || !accountType) {
      return NextResponse.json(
        { error: "Full name, email, password and valid account type are required" },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const existingEmail = await hasAnyExistingProfileWithEmail(email)
    if (existingEmail) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
    }

    const role = await getOrCreateClientRole()
    const { first_name, last_name } = splitFullName(fullName)
    const hashedPassword = await hashPassword(password)

    await prisma.$transaction(async (tx) => {
      const [userTaken, principalTaken] = await Promise.all([
        tx.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          select: { id: true },
        }),
        tx.principalAccount.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          select: { id: true },
        }),
      ])

      if (userTaken || principalTaken) {
        throw new Error("ACCOUNT_ALREADY_EXISTS")
      }

      const { orgName, code, organizationId } = await generateUniqueOrganizationIdentity(fullName, tx as typeof prisma)

      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          first_name,
          last_name,
          role_id: role.id,
          status: "ACTIVE",
          first_login: false,
          title: accountType,
        },
      })

      const organization = await tx.organization.create({
        data: {
          organization_id: organizationId,
          name: orgName,
          code,
          type: organizationTypeFor(accountType),
          business_type: accountType,
          status: "ACTIVE",
        },
      })

      await tx.clientAccount.create({
        data: {
          user_id: user.id,
          organization_id: organization.id,
          account_type: accountType,
          status: "ACTIVE",
        },
      })
    })

    try {
      await notificationService.sendEmail({
        to: email,
        subject: "Client Account Registration Successful",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0f172a;">Welcome to Aspirage</h2>
            <p>Your client account registration was successful.</p>
            <p><strong>Name:</strong> ${fullName}</p>
            <p><strong>Account Type:</strong> ${accountType.replace(/_/g, " ")}</p>
            <p>You can now log in from the client portal to view plans and submit requests.</p>
          </div>
        `,
        text: `Welcome to Aspirage. Your client account registration was successful.`,
      })
    } catch (notificationError) {
      console.error("Client account created but welcome email failed:", notificationError)
    }

    return NextResponse.json(
      {
        success: true,
        message: "Registration successful. Please log in to continue.",
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_ALREADY_EXISTS") {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
    }
    console.error("Client registration error:", error)
    return NextResponse.json({ error: "Failed to register client account" }, { status: 500 })
  }
}
