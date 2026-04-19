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

    const { newPassword } = await request.json()

    if (!newPassword) {
      return NextResponse.json({ 
        error: 'New password is required' 
      }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ 
        error: 'New password must be at least 6 characters long' 
      }, { status: 400 })
    }

    // Get user to check if it's their first login
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, first_login: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.first_login) {
      return NextResponse.json({ 
        error: 'This is not your first login' 
      }, { status: 400 })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Update password and mark as not first login
    await prisma.user.update({
      where: { id: session.user.id },
      data: { 
        password: hashedPassword,
        first_login: false
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'FIRST_LOGIN_PASSWORD_SET',
        resource: 'user',
        resource_id: session.user.id,
        old_values: { first_login: true },
        new_values: { first_login: false, password_set: true }
      }
    })

    return NextResponse.json({ 
      message: 'Password set successfully' 
    })
  } catch (error) {
    console.error('Error setting first login password:', error)
    return NextResponse.json(
      { error: 'Failed to set password' },
      { status: 500 }
    )
  }
}
