/**
 * POST /api/mobile/auth/enrollee/request-otp
 * Body: { enrollee_id: string, email: string }
 *
 * Validates the enrollee_id + email match a PrincipalAccount,
 * generates a 6-digit OTP, stores a bcrypt hash, and emails it.
 */
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { notificationService } from "@/lib/notifications"
import { trackStatisticsEvent } from "@/lib/statistics-events"

// Rate-limit: max 3 OTP requests per enrollee per 10 minutes (in-memory, good enough for moderate load)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 })
    return false
  }
  if (entry.count >= 3) return true
  entry.count++
  return false
}

function generateOtp(): string {
  return Math.floor(100_000 + Math.random() * 900_000).toString()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const identifier = (body.enrollee_id as string || body.identifier as string)?.trim()

    if (!identifier) {
      return NextResponse.json(
        { error: "Enrollee ID or Email is required" },
        { status: 400 }
      )
    }

    // Rate limit
    if (isRateLimited(identifier.toUpperCase())) {
      await trackStatisticsEvent({
        event: "otp_request",
        module: "auth",
        stage: "otp_request",
        outcome: "failed",
        actorType: "enrollee",
        enrolleeId: identifier.toUpperCase(),
        metadata: { reason: "rate_limited" },
        req,
      })
      return NextResponse.json(
        { error: "Too many OTP requests. Please wait 10 minutes." },
        { status: 429 }
      )
    }

    // Look up by identifier (enrollee_id OR email)
    console.log(`\n[OTP] Looking up enrollee with identifier="${identifier}"`)
    
    // 1. Check PrincipalAccount
    const principal = await prisma.principalAccount.findFirst({
      where: {
        OR: [
          { enrollee_id: { equals: identifier, mode: "insensitive" } },
          { email: { equals: identifier.toLowerCase(), mode: "insensitive" } },
        ],
        status: "ACTIVE",
      },
      select: { id: true, first_name: true, last_name: true, email: true, enrollee_id: true },
    })

    let account = principal ? { ...principal, type: "PRINCIPAL" } : null

    // 2. If not found, check Dependent
    if (!account) {
      const dependent = await prisma.dependent.findFirst({
        where: {
          OR: [
            { dependent_id: { equals: identifier, mode: "insensitive" } },
            { email: { equals: identifier.toLowerCase(), mode: "insensitive" } },
          ],
          status: "ACTIVE",
        },
        select: { id: true, first_name: true, last_name: true, email: true, dependent_id: true },
      })
      if (dependent) {
        account = {
          id: dependent.id,
          first_name: dependent.first_name,
          last_name: dependent.last_name,
          email: dependent.email,
          enrollee_id: dependent.dependent_id, // Map dependent_id to enrollee_id for the OTP flow
          type: "DEPENDENT"
        }
      }
    }

    console.log(`[OTP] Result:`, account
      ? `found type=${account.type} id=${account.id} enrollee_id=${account.enrollee_id} email=${account.email}`
      : "NOT FOUND")

    // Return 404 if enrollee not found
    if (!account) {
      await trackStatisticsEvent({
        event: "otp_request",
        module: "auth",
        stage: "otp_request",
        outcome: "failed",
        actorType: "enrollee",
        enrolleeId: identifier.toUpperCase(),
        metadata: { reason: "account_not_found" },
        req,
      })
      return NextResponse.json(
        { error: "Account not found. Please check your ID or Email and try again." },
        { status: 404 }
      )
    }

    if (account) {
      const otp = generateOtp()
      console.log("\n========================================")
      console.log("🔑 OTP DEBUG")
      console.log(`   Account Type: ${account.type}`)
      console.log(`   ID          : ${account.enrollee_id}`)
      console.log(`   Email       : ${account.email}`)
      console.log(`   OTP Code    : ${otp}`)
      console.log("========================================\n")
      const otp_hash = await bcrypt.hash(otp, 10)
      const expires_at = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

      // Invalidate any previous unused OTPs for this enrollee/dependent
      await prisma.mobileOtp.updateMany({
        where: { enrollee_id: account.enrollee_id, used: false },
        data:  { used: true },
      })

      const enrolleeEmail = account.email!
      await prisma.mobileOtp.create({
        data: { enrollee_id: account.enrollee_id, email: enrolleeEmail, otp_hash, expires_at },
      })

      await trackStatisticsEvent({
        event: "otp_request",
        module: "auth",
        stage: "otp_request",
        outcome: "success",
        actorType: "enrollee",
        actorId: account.id,
        enrolleeId: account.enrollee_id,
        metadata: { accountType: account.type },
        req,
      })

      // Send OTP email
      console.log(`[OTP] Sending email to ${enrolleeEmail} via Resend...`)
      try {
        await notificationService.sendEmail({
          to:      enrolleeEmail,
          subject: "Your Aspirage Login Code",
          skipSuperAdminCopy: true,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#1a56db">Aspirage</h2>
              <p>Hello <strong>${account.first_name}</strong>,</p>
              <p>Your one-time login code is:</p>
              <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1a56db;
                          text-align:center;padding:16px;background:#eff6ff;border-radius:8px;
                          margin:16px 0">
                ${otp}
              </div>
              <p style="color:#6b7280;font-size:13px">
                This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
              </p>
              <p style="color:#6b7280;font-size:12px">
                If you did not request this code, please ignore this email.
              </p>
            </div>`,
        })
        console.log(`[OTP] ✅ Email sent successfully to ${enrolleeEmail}`)
      } catch (emailErr) {
        console.error(`[OTP] ❌ Email send FAILED:`, emailErr)
      }
    }

    return NextResponse.json({
      message: "OTP sent successfully to your registered email.",
      enrollee_id: account.enrollee_id,
    })
  } catch (error) {
    console.error("[MOBILE_ENROLLEE_REQUEST_OTP]", error)
    await trackStatisticsEvent({
      event: "otp_request",
      module: "auth",
      stage: "otp_request",
      outcome: "failed",
      actorType: "system",
      metadata: { reason: "server_error" },
      req,
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
