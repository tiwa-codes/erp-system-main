/**
 * POST /api/mobile/auth/enrollee/verify-otp
 * Body: { enrollee_id: string, email: string, otp: string }
 *
 * Verifies the OTP, marks it used, and returns a signed 60-day JWT.
 * The JWT sub = PrincipalAccount.id (principalId), token_type = "ENROLLEE".
 */
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { signEnrolleeToken } from "@/lib/mobile-auth"
import { trackStatisticsEvent } from "@/lib/statistics-events"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const enrollee_id = (body.enrollee_id as string)?.trim().toUpperCase()
    const otp         = (body.otp as string)?.trim()

    if (!enrollee_id || !otp) {
      await trackStatisticsEvent({
        event: "otp_verify",
        module: "auth",
        stage: "otp_verify",
        outcome: "failed",
        actorType: "enrollee",
        enrolleeId: enrollee_id || null,
        metadata: { reason: "missing_fields" },
        req,
      })
      return NextResponse.json(
        { error: "enrollee_id and otp are required" },
        { status: 400 }
      )
    }

    // Find the most recent unused, unexpired OTP for this enrollee
    const otpRecord = await prisma.mobileOtp.findFirst({
      where: {
        enrollee_id: { equals: enrollee_id, mode: "insensitive" },
        used:        false,
        expires_at:  { gt: new Date() },
      },
      orderBy: { created_at: "desc" },
    })

    if (!otpRecord) {
      await trackStatisticsEvent({
        event: "otp_verify",
        module: "auth",
        stage: "otp_verify",
        outcome: "failed",
        actorType: "enrollee",
        enrolleeId: enrollee_id,
        metadata: { reason: "invalid_or_expired" },
        req,
      })
      return NextResponse.json(
        { error: "Invalid or expired code. Please request a new one." },
        { status: 401 }
      )
    }

    const valid = await bcrypt.compare(otp, otpRecord.otp_hash)
    if (!valid) {
      await trackStatisticsEvent({
        event: "otp_verify",
        module: "auth",
        stage: "otp_verify",
        outcome: "failed",
        actorType: "enrollee",
        enrolleeId: enrollee_id,
        metadata: { reason: "wrong_code" },
        req,
      })
      return NextResponse.json(
        { error: "Incorrect code. Please try again." },
        { status: 401 }
      )
    }

    // Mark OTP as used
    await prisma.mobileOtp.update({
      where: { id: otpRecord.id },
      data:  { used: true },
    })

    // Fetch principal or dependent
    let userRecord: { id: string, name: string, email: string, enrollee_id: string } | null = null

    // 1. Try Principal
    const principal = await prisma.principalAccount.findFirst({
      where: {
        enrollee_id: { equals: enrollee_id, mode: "insensitive" },
        status:      "ACTIVE",
      },
      select: {
        id:          true,
        enrollee_id: true,
        first_name:  true,
        last_name:   true,
        email:       true,
      },
    })

    if (principal) {
      userRecord = {
        id: principal.id,
        name: `${principal.first_name} ${principal.last_name}`,
        email: principal.email!,
        enrollee_id: principal.enrollee_id
      }
    } else {
      // 2. Try Dependent
      const dependent = await prisma.dependent.findFirst({
        where: {
          dependent_id: { equals: enrollee_id, mode: "insensitive" },
          status:        "ACTIVE",
        },
        select: {
          id:           true,
          dependent_id: true,
          first_name:   true,
          last_name:    true,
          email:        true,
        },
      })
      if (dependent) {
        userRecord = {
          id: dependent.id,
          name: `${dependent.first_name} ${dependent.last_name}`,
          email: dependent.email!,
          enrollee_id: dependent.dependent_id
        }
      }
    }

    if (!userRecord) {
      await trackStatisticsEvent({
        event: "otp_verify",
        module: "auth",
        stage: "otp_verify",
        outcome: "failed",
        actorType: "enrollee",
        enrolleeId: enrollee_id,
        metadata: { reason: "account_not_found_or_inactive" },
        req,
      })
      return NextResponse.json({ error: "Account not found or inactive." }, { status: 404 })
    }

    const token = await signEnrolleeToken({
      id:          userRecord.id,
      email:       userRecord.email,
      name:        userRecord.name,
      role:        "ENROLLEE",
      enrollee_id: userRecord.enrollee_id,
    })

    await trackStatisticsEvent({
      event: "otp_verify",
      module: "auth",
      stage: "otp_verify",
      outcome: "success",
      actorType: "enrollee",
      actorId: userRecord.id,
      enrolleeId: userRecord.enrollee_id,
      req,
    })
    await trackStatisticsEvent({
      event: "enrollee_login",
      module: "auth",
      stage: "login",
      outcome: "success",
      actorType: "enrollee",
      actorId: userRecord.id,
      enrolleeId: userRecord.enrollee_id,
      req,
    })

    return NextResponse.json({
      token,
      user: {
        id:          userRecord.id,
        email:       userRecord.email,
        name:        userRecord.name,
        role:        "ENROLLEE",
        enrollee_id: userRecord.enrollee_id,
        first_login: false,
      },
    })
  } catch (error) {
    console.error("[MOBILE_ENROLLEE_VERIFY_OTP]", error)
    await trackStatisticsEvent({
      event: "otp_verify",
      module: "auth",
      stage: "otp_verify",
      outcome: "failed",
      actorType: "system",
      metadata: { reason: "server_error" },
      req,
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
