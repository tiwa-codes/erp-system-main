import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import { notificationService } from '@/lib/notifications'
import { hashPassword } from '@/lib/auth-utils'

// Generate a random password
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to edit users
    const canEdit = await checkPermission(session.user.role as any, 'users', 'edit')
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const userId = params.id

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let sendEmail = true
    try {
      const body = await request.json()
      if (typeof body?.sendEmail === 'boolean') {
        sendEmail = body.sendEmail
      }
    } catch {
      // Empty body means default behavior (send email)
    }

    // Generate new password
    const newPassword = generateRandomPassword()
    const hashedPassword = await hashPassword(newPassword)

    // Update user password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    })

    // Send password reset email (optional)
    if (sendEmail) {
      try {
        await notificationService.sendNewPasswordEmail(
          user.email,
          `${user.first_name} ${user.last_name}`,
          newPassword
        )
      } catch (emailError) {
        console.error('Email sending failed:', emailError)
        // Don't fail the password reset if email fails
      }
    }

    // Log the password reset
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PASSWORD_RESET',
        resource: 'users',
        resource_id: userId,
        new_values: {
          reset_by: session.user.email,
          reset_for: user.email,
          send_email: sendEmail
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: sendEmail ? 'Password reset successfully' : 'Temporary password generated successfully',
      tempPassword: newPassword,
      loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://crownjewelhmo.sbfy360.com'}/auth/signin`,
      user: {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email
      }
    })

  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    )
  }
}
