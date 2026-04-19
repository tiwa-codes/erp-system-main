import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow super admin to run this
    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update admin user's first_login to false
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { first_login: false }
    })

    return NextResponse.json({ 
      message: 'Admin first_login updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        first_login: updatedUser.first_login
      }
    })
  } catch (error) {
    console.error('Error updating admin first_login:', error)
    return NextResponse.json(
      { error: 'Failed to update admin first_login' },
      { status: 500 }
    )
  }
}
