import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        provider: {
          select: {
            id: true,
            facility_name: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      phone: user.phone_number,
      profile_picture: user.profile_picture || null,
      last_login: user.last_login_at,
      created_at: user.created_at,
      role: user.role,
      status: user.status,
      provider_id: user.provider?.id || null,
      provider_name: user.provider?.facility_name || null
    })
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}
