import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import { hashPassword, generateRandomPassword } from '@/lib/auth-utils'
import { notificationService } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to manage users
    const canManage = await checkPermission(session.user.role as any, 'users', 'edit')
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { userIds } = body

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'User IDs are required' }, { status: 400 })
    }

    const results = []
    const errors = []

    for (const userId of userIds) {
      try {
        // Get user details
        const user = await prisma.user.findUnique({
          where: { id: userId }
        })

        if (!user) {
          errors.push({ userId, error: 'User not found' })
          continue
        }

        // Generate new password
        const newPassword = generateRandomPassword()
        const hashedPassword = await hashPassword(newPassword)

        // Update user password
        await prisma.user.update({
          where: { id: userId },
          data: { password: hashedPassword }
        })

        // Send password reset email
        try {
          await notificationService.sendPasswordResetEmail(user.email, newPassword)
          results.push({ userId, email: user.email, success: true })
        } catch (emailError) {
          // Password was reset but email failed
          results.push({ userId, email: user.email, success: true, emailError: 'Failed to send email' })
        }

        // Log the password reset
        await prisma.auditLog.create({
          data: {
            user_id: session.user.id,
            action: 'PASSWORD_RESET',
            resource_type: 'users',
            resource_id: userId,
            details: {
              reset_by: session.user.email,
              reset_for: user.email
            }
          }
        })

      } catch (error) {
        errors.push({ userId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return NextResponse.json({
      message: 'Password reset completed',
      results,
      errors,
      summary: {
        total: userIds.length,
        successful: results.length,
        failed: errors.length
      }
    })
  } catch (error) {
    console.error('Error in bulk password reset:', error)
    return NextResponse.json(
      { error: 'Failed to reset passwords' },
      { status: 500 }
    )
  }
}
