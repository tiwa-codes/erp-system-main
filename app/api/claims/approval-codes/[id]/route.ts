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

    const canView = await checkPermission(session.user.role as any, 'claims', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const approvalCodeId = params.id

    const approvalCode = await prisma.claim.findUnique({
      where: {
        id: approvalCodeId
      },
      include: {
        principal: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true,
            phone_number: true,
            email: true,
            residential_address: true,
          }
        },
        provider: {
          select: {
            id: true,
            facility_name: true,
            facility_type: true,
            address: true,
            phone_whatsapp: true,
            email: true,
          }
        },
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          }
        }
      }
    })

    if (!approvalCode) {
      return NextResponse.json({ error: 'Approval code not found' }, { status: 404 })
    }

    // Transform the data to match the expected format
    const transformedApprovalCode = {
      id: approvalCode.id,
      claim_number: approvalCode.claim_number,
      requested_by: approvalCode.created_by ? 
        `${approvalCode.created_by.first_name} ${approvalCode.created_by.last_name}` : 
        approvalCode.provider?.facility_name || 'System',
      hospital: approvalCode.provider?.facility_name || 'Unknown',
      services: approvalCode.description || 'General Service',
      amount: approvalCode.amount || 0,
      status: approvalCode.status,
      date: approvalCode.created_at.toISOString(),
      claim_id: approvalCode.id,
      provider_id: approvalCode.provider_id,
      provider: approvalCode.provider,
      principal: approvalCode.principal,
    }

    return NextResponse.json(transformedApprovalCode)
  } catch (error) {
    console.error('Error fetching approval code:', error)
    return NextResponse.json(
      { error: 'Failed to fetch approval code' },
      { status: 500 }
    )
  }
}
