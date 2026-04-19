import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canViewProviders = await checkPermission(session.user.role as any, 'provider', 'view')
    if (!canViewProviders) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const facility_type = searchParams.get('facility_type') || ''

    // Build where clause - only ACTIVE providers
    const where: any = {
      status: 'ACTIVE' // Only return approved providers
    }
    
    if (search) {
      where.facility_name = {
        contains: search,
        mode: 'insensitive'
      }
    }

    if (facility_type && facility_type !== 'all') {
      where.facility_type = {
        array_contains: [facility_type]
      }
    }

    const providers = await prisma.provider.findMany({
      where,
      select: {
        id: true,
        facility_name: true,
        facility_type: true,
        address: true,
        phone_whatsapp: true,
        email: true,
        hcp_code: true,
        status: true
      },
      orderBy: { facility_name: 'asc' },
    })

    return NextResponse.json({
      providers
    })
  } catch (error) {
    console.error('Error fetching active providers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch active providers' },
      { status: 500 }
    )
  }
}
