import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get principals for claims forms (less restrictive than underwriting view)
    const principals = await prisma.principalAccount.findMany({
      select: {
        id: true,
        enrollee_id: true,
        first_name: true,
        last_name: true,
        organization: {
          select: {
            id: true,
            name: true,
          }
        },
        plan: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    return NextResponse.json({ principals })
  } catch (error) {
    console.error('Error fetching principals for claims:', error)
    return NextResponse.json(
      { error: 'Failed to fetch principals' },
      { status: 500 }
    )
  }
}
