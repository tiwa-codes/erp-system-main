import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to view principals
    const canView = await checkPermission(session.user.role as any, 'underwriting', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    // Fetch principal data with related information
    const principal = await prisma.principalAccount.findUnique({
      where: { id },
      include: {
        plan: true,
        organization: true,
        dependents: true
      }
    })

    if (!principal) {
      return NextResponse.json({ error: 'Principal not found' }, { status: 404 })
    }

    // Format data for ID card
    const idCardData = {
      id: principal.id,
      name: `${principal.first_name} ${principal.last_name}`,
      policy_number: principal.enrollee_id || `CJH/T4/${principal.id.slice(-4)}`,
      plan_name: principal.plan?.name || 'SILVER FAMILY PLAN',
      organization_name: principal.organization?.name || 'TEAM 4 RECRUITS',
      email: principal.email,
      phone: principal.phone_number,
      date_of_birth: principal.date_of_birth,
      gender: principal.gender,
      account_type: principal.account_type,
      status: principal.status,
      created_at: principal.created_at,
      profile_picture: principal.profile_picture,
      plan_details: principal.plan ? {
        name: principal.plan.name,
        premium_amount: principal.plan.premium_amount,
        annual_limit: principal.plan.annual_limit
      } : null,
      organization_details: principal.organization ? {
        name: principal.organization.name,
        code: principal.organization.code
      } : null,
      dependents_count: principal.dependents?.length || 0
    }

    return NextResponse.json(idCardData)
  } catch (error) {
    console.error('Error fetching principal ID card data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch principal data' },
      { status: 500 }
    )
  }
}
