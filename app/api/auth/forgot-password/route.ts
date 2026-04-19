import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { notificationService } from '@/lib/notifications'

const GENERIC_SUCCESS_MESSAGE =
  'If an account exists with that email, a password reset link has been sent.'
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

// In-memory rate limiter for reset requests.
const resetRequestRateLimit = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(key: string, maxRequests = 5, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now()
  const entry = resetRequestRateLimit.get(key)

  if (!entry || now > entry.resetAt) {
    resetRequestRateLimit.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }

  if (entry.count >= maxRequests) {
    return true
  }

  entry.count++
  return false
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }

  return request.ip || 'unknown'
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function isLikelyEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    // Always return a generic message to avoid account enumeration.
    if (!email || !isLikelyEmail(email)) {
      return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE }, { status: 200 })
    }

    const rateLimitKey = `${getClientIp(request)}:${email}`
    if (isRateLimited(rateLimitKey)) {
      return NextResponse.json(
        { error: 'Too many reset attempts. Please wait 10 minutes and try again.' },
        { status: 429 }
      )
    }

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
      },
    })

    if (!user) {
      return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE }, { status: 200 })
    }

    const rawToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_reset_token: hashedToken,
        password_reset_expires: expiresAt,
      },
    })

    await notificationService.sendPasswordResetEmail(user.email, rawToken)

    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        resource: 'auth',
        resource_id: user.id,
        new_values: {
          requested_at: new Date().toISOString(),
          via: 'self-service',
        },
      },
    })

    return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE }, { status: 200 })
  } catch (error) {
    console.error('Error requesting password reset:', error)
    // Keep response generic for security.
    return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE }, { status: 200 })
  }
}
