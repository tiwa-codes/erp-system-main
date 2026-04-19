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

    const canViewRequests = await checkPermission(session.user.role as any, 'call-centre', 'view')
    if (!canViewRequests) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const requestId = params.id

    // Fetch the provider request with all related data
    const providerRequest = await prisma.providerRequest.findUnique({
      where: { id: requestId },
      include: {
        provider: {
          select: {
            facility_name: true,
            facility_type: true,
            status: true
          }
        },
        enrollee: {
          select: {
            enrollee_id: true,
            first_name: true,
            last_name: true,
            organization: {
              select: {
                name: true
              }
            },
            plan: {
              select: {
                name: true,
                plan_type: true
              }
            }
          }
        }
      }
    })

    if (!providerRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Format the response to match the expected structure
    const beneficiaryId = providerRequest.beneficiary_id || providerRequest.enrollee?.enrollee_id || ''
    const beneficiaryName = providerRequest.beneficiary_name || `${providerRequest.enrollee?.first_name || ''} ${providerRequest.enrollee?.last_name || ''}`.trim()
    const isDependent = !!providerRequest.beneficiary_id && providerRequest.beneficiary_id !== providerRequest.enrollee?.enrollee_id

    const formattedRequest = {
      id: providerRequest.id,
      request_id: providerRequest.request_id,
      enrollee_id: beneficiaryId,
      enrollee_name: beneficiaryName,
      beneficiary_id: providerRequest.beneficiary_id,
      beneficiary_name: providerRequest.beneficiary_name,
      is_dependent: isDependent,
      organization: providerRequest.enrollee?.organization?.name || '',
      plan: providerRequest.enrollee?.plan?.name || '',
      diagnosis: providerRequest.diagnosis || '',
      provider_name: providerRequest.provider?.facility_name || '',
      hospital_name: providerRequest.provider?.facility_name || '',
      services: providerRequest.services || [],
      total_amount: providerRequest.amount || 0,
      status: providerRequest.status,
      date: providerRequest.created_at,
      admission_required: providerRequest.admission_required || false
    }

    return NextResponse.json({ request: formattedRequest })
  } catch (error) {
    console.error('Error fetching provider request:', error)
    return NextResponse.json(
      { error: 'Failed to fetch provider request' },
      { status: 500 }
    )
  }
}
