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

    // Check permission to view dependents
    const canView = await checkPermission(session.user.role as any, 'underwriting', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    // Fetch dependent data with related information
    const dependent = await prisma.dependent.findUnique({
      where: { id },
      include: {
        principal: {
          include: {
            plan: true,
            organization: true
          }
        }
      }
    })

    if (!dependent) {
      return NextResponse.json({ error: 'Dependent not found' }, { status: 404 })
    }

    // Format data for ID card
    const idCardData = {
      id: dependent.id,
      name: `${dependent.first_name} ${dependent.last_name}`,
      policy_number: dependent.principal?.enrollee_id || `CJH/T4/${dependent.id.slice(-4)}`,
      plan_name: dependent.principal?.plan?.name || 'SILVER FAMILY PLAN',
      organization_name: dependent.principal?.organization?.name || 'TEAM 4 RECRUITS',
      email: dependent.email,
      phone: dependent.phone_number,
      date_of_birth: dependent.date_of_birth,
      gender: dependent.gender,
      relationship: dependent.relationship,
      status: dependent.status,
      created_at: dependent.created_at,
      profile_picture: dependent.profile_picture,
      principal_name: `${dependent.principal?.first_name} ${dependent.principal?.last_name}`,
      plan_details: dependent.principal?.plan ? {
        name: dependent.principal.plan.name,
        premium_amount: dependent.principal.plan.premium_amount,
        annual_limit: dependent.principal.plan.annual_limit
      } : null,
      organization_details: dependent.principal?.organization ? {
        name: dependent.principal.organization.name,
        code: dependent.principal.organization.code
      } : null
    }

    return NextResponse.json(idCardData)
  } catch (error) {
    console.error('Error fetching dependent ID card data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dependent data' },
      { status: 500 }
    )
  }
}
