/**
 * Mobile auth utilities — JWT signing/verification for mobile Bearer tokens.
 * Uses next-auth's built-in JWT encode/decode so no extra dependency is needed.
 *
 * Two token types:
 *  - "STAFF"    : sub = userId (User.id)     — password login
 *  - "ENROLLEE" : sub = principalId (PrincipalAccount.id) — OTP login
 */
import { encode, decode } from "next-auth/jwt"
import { NextRequest } from "next/server"

const MOBILE_JWT_SECRET = process.env.NEXTAUTH_SECRET || "fallback-dev-secret-change-in-prod"
// 60 days in seconds
const MOBILE_TOKEN_MAX_AGE = 60 * 24 * 60 * 60

/** Shared fields for all mobile tokens */
interface MobileTokenBase {
  /** JWT subject — userId for STAFF, principalId for ENROLLEE */
  id: string
  email: string
  name: string
  role: string
  token_type: "STAFF" | "ENROLLEE"
  iat?: number
  exp?: number
}

/** Additional fields only present on STAFF tokens */
export interface StaffTokenPayload extends MobileTokenBase {
  token_type: "STAFF"
  departmentId: string | null
  provider_id: string | null
  first_login: boolean
}

/** Additional fields only present on ENROLLEE tokens */
export interface EnrolleeTokenPayload extends MobileTokenBase {
  token_type: "ENROLLEE"
  enrollee_id: string // PrincipalAccount.enrollee_id (display ID)
}

export type MobileTokenPayload = StaffTokenPayload | EnrolleeTokenPayload

// ─────────────────────────────────────────────────────────────────────────────
// Sign helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function signStaffToken(
  payload: Omit<StaffTokenPayload, "token_type" | "iat" | "exp">
): Promise<string> {
  return encode({
    token: { ...payload, sub: payload.id, token_type: "STAFF", department: null },
    secret: MOBILE_JWT_SECRET,
    maxAge: MOBILE_TOKEN_MAX_AGE,
    salt: "mobile-token",
  })
}

export async function signEnrolleeToken(
  payload: Omit<EnrolleeTokenPayload, "token_type" | "iat" | "exp">
): Promise<string> {
  return encode({
    token: { ...payload, sub: payload.id, token_type: "ENROLLEE" },
    secret: MOBILE_JWT_SECRET,
    maxAge: MOBILE_TOKEN_MAX_AGE,
    salt: "mobile-token",
  })
}

/** @deprecated — kept for backwards compat; use signStaffToken or signEnrolleeToken */
export async function signMobileToken(
  payload: Omit<StaffTokenPayload, "token_type" | "iat" | "exp">
): Promise<string> {
  return signStaffToken(payload)
}

// ─────────────────────────────────────────────────────────────────────────────
// Verify
// ─────────────────────────────────────────────────────────────────────────────

export async function verifyMobileToken(req: NextRequest): Promise<MobileTokenPayload | null> {
  try {
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) return null

    const decoded = await decode({
      token: authHeader.slice(7),
      secret: MOBILE_JWT_SECRET,
      salt: "mobile-token",
    })
    if (!decoded?.sub) return null

    const type = (decoded.token_type as string) || "STAFF"

    if (type === "ENROLLEE") {
      return {
        token_type: "ENROLLEE",
        id: decoded.sub,
        email: decoded.email as string,
        name: decoded.name as string,
        role: decoded.role as string,
        enrollee_id: decoded.enrollee_id as string,
      } satisfies EnrolleeTokenPayload
    }

    // STAFF (default — also handles legacy tokens without token_type)
    return {
      token_type: "STAFF",
      id: decoded.sub,
      email: decoded.email as string,
      name: decoded.name as string,
      role: decoded.role as string,
      departmentId: (decoded.departmentId as string) || null,
      provider_id: (decoded.provider_id as string) || null,
      first_login: (decoded.first_login as boolean) ?? false,
    } satisfies StaffTokenPayload
  } catch {
    return null
  }
}

export async function getSessionOrToken(req: NextRequest): Promise<MobileTokenPayload | null> {
  return verifyMobileToken(req)
}
