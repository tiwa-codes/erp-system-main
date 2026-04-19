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

    // Get fresh user data from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        first_login: true,
        role: true,
        status: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      message: 'Session refresh data',
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        role: user.role,
        status: user.status,
        first_login: user.first_login
      },
      session: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        first_login: (session.user as any).first_login
      },
      shouldShowModal: user.first_login
    })
  } catch (error) {
    console.error('Error refreshing session:', error)
    return NextResponse.json(
      { error: 'Failed to refresh session' },
      { status: 500 }
    )
  }
}
