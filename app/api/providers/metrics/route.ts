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

    // Calculate metrics
    const [
      total_providers,
      active_providers,
      pending_approval,
      suspended_providers,
      total_claims,
      total_inpatients
    ] = await Promise.all([
      prisma.provider.count(),
      prisma.provider.count({ where: { status: 'ACTIVE' } }),
      prisma.provider.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.provider.count({ where: { status: 'SUSPENDED' } }),
      prisma.claim.count(),
      prisma.inPatient.count()
    ])

    return NextResponse.json({
      total_providers,
      active_providers,
      pending_approval,
      suspended_providers,
      total_claims,
      total_inpatients
    })
  } catch (error) {
    console.error('Error fetching provider metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch provider metrics' },
      { status: 500 }
    )
  }
}
