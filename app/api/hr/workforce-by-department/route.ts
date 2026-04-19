import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const canView = await checkPermission(session.user.role as any, 'hr', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    // Get departments with employee counts
    const departments = await prisma.department.findMany({
      include: {
        employees: {
          where: {
            status: 'ACTIVE'
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Generate data for the last 7 days
    const data = []
    const today = new Date()
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      
      const dayData = {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count: Math.floor(Math.random() * 20) + 10 // Mock data for now
      }
      
      data.push(dayData)
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Error fetching workforce data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workforce data' },
      { status: 500 }
    )
  }
}
