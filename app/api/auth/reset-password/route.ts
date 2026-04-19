import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth-utils'

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'Reset token and new password are required' },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    const tokenHash = hashToken(token)

    const user = await prisma.user.findFirst({
      where: {
        password_reset_token: tokenHash,
        password_reset_expires: { gt: new Date() },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(newPassword)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        first_login: false,
        password_reset_token: null,
        password_reset_expires: null,
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'PASSWORD_RESET_COMPLETED',
        resource: 'auth',
        resource_id: user.id,
        new_values: {
          reset_at: new Date().toISOString(),
          via: 'self-service',
        },
      },
    })

    return NextResponse.json({ message: 'Password reset successful' }, { status: 200 })
  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    )
  }
}
