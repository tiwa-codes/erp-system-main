import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canViewProviders = await checkPermission(session.user.role as any, 'provider', 'view')
    if (!canViewProviders) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const riskProfile = await prisma.providerRiskProfile.findUnique({
      where: { id: params.id },
      include: {
        provider: {
          select: {
            id: true,
            facility_name: true,
            facility_type: true
          }
        }
      }
    })

    if (!riskProfile) {
      return NextResponse.json({ error: 'Risk profile not found' }, { status: 404 })
    }

    return NextResponse.json(riskProfile)
  } catch (error) {
    console.error('Error fetching risk profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch risk profile' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canEditProviders = await checkPermission(session.user.role as any, 'provider', 'edit')
    if (!canEditProviders) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      provider_id,
      risk_score,
      risk_level,
      assessment_date,
      factors,
      recommendations
    } = body

    const existingRiskProfile = await prisma.providerRiskProfile.findUnique({
      where: { id: params.id }
    })

    if (!existingRiskProfile) {
      return NextResponse.json({ error: 'Risk profile not found' }, { status: 404 })
    }

    const updatedRiskProfile = await prisma.providerRiskProfile.update({
      where: { id: params.id },
      data: {
        provider_id,
        risk_score,
        risk_level,
        assessment_date: assessment_date ? new Date(assessment_date) : undefined,
        factors,
        recommendations
      }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PROVIDER_RISK_ASSESSMENT_UPDATE',
        resource: 'provider_risk_profile',
        resource_id: params.id,
        old_values: existingRiskProfile,
        new_values: updatedRiskProfile,
      },
    })

    return NextResponse.json(updatedRiskProfile)
  } catch (error) {
    console.error('Error updating risk profile:', error)
    return NextResponse.json(
      { error: 'Failed to update risk profile' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canDeleteProviders = await checkPermission(session.user.role as any, 'provider', 'delete')
    if (!canDeleteProviders) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existingRiskProfile = await prisma.providerRiskProfile.findUnique({
      where: { id: params.id }
    })

    if (!existingRiskProfile) {
      return NextResponse.json({ error: 'Risk profile not found' }, { status: 404 })
    }

    await prisma.providerRiskProfile.delete({
      where: { id: params.id }
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'PROVIDER_RISK_ASSESSMENT_DELETE',
        resource: 'provider_risk_profile',
        resource_id: params.id,
        old_values: existingRiskProfile,
      },
    })

    return NextResponse.json({ message: 'Risk profile deleted successfully' })
  } catch (error) {
    console.error('Error deleting risk profile:', error)
    return NextResponse.json(
      { error: 'Failed to delete risk profile' },
      { status: 500 }
    )
  }
}
