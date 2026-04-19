import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ 
        error: 'Current password and new password are required' 
      }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ 
        error: 'New password must be at least 6 characters long' 
      }, { status: 400 })
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true, first_login: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
    if (!isCurrentPasswordValid) {
      return NextResponse.json({ 
        error: 'Current password is incorrect' 
      }, { status: 400 })
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12)

    // Update password and mark as not first login
    await prisma.user.update({
      where: { id: session.user.id },
      data: { 
        password: hashedNewPassword,
        first_login: false
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PASSWORD_CHANGE',
        resource: 'user',
        resource_id: session.user.id,
        old_values: { password_changed: true },
        new_values: { password_changed: true, first_login: false }
      }
    })

    return NextResponse.json({ 
      message: 'Password changed successfully' 
    })
  } catch (error) {
    console.error('Error changing password:', error)
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    )
  }
}
