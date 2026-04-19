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
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has call-centre view permissions
    const hasPermission = await checkPermission(session.user.role as any, "call-centre", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = params

    // Determine if id is UUID or Approval Code string
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

    // Find the approval code with all related data
    const approvalCode = await prisma.approvalCode.findUnique({
      where: isUUID ? { id } : { approval_code: id },
      include: {
        service_items: {
          include: {
            added_by: {
              select: {
                id: true,
                first_name: true,
                last_name: true
              }
            }
          },
          orderBy: { added_at: 'asc' }
        },
        enrollee: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        },
        generated_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true
          }
        }
      }
    })

    if (!approvalCode) {
      return NextResponse.json({ error: "Approval code does not exist" }, { status: 404 })
    }

    // Block access to soft-deleted codes (detail view)
    if (approvalCode.is_deleted) {
      return NextResponse.json({ error: "Approval code does not exist" }, { status: 404 })
    }

    // Group services by when they were added
    const initialServices = approvalCode.service_items.filter(s => s.is_initial)
    const addedServices = approvalCode.service_items.filter(s => !s.is_initial)

    return NextResponse.json({
      success: true,
      approval_code: {
        id: approvalCode.id,
        approval_code: approvalCode.approval_code,
        enrollee_id: approvalCode.enrollee_id,
        enrollee_name: approvalCode.enrollee_name,
        hospital: approvalCode.hospital,
        diagnosis: approvalCode.diagnosis,
        clinical_encounter: approvalCode.clinical_encounter,
        admission_required: approvalCode.admission_required,
        status: approvalCode.status,
        amount: approvalCode.amount,
        created_at: approvalCode.created_at,
        updated_at: approvalCode.updated_at,
        enrollee: approvalCode.enrollee,
        generated_by: approvalCode.generated_by,
        initial_services: initialServices.map(s => ({
          id: s.id,
          service_name: s.service_name,
          service_amount: s.service_amount,
          added_at: s.added_at
        })),
        added_services: addedServices.map(s => ({
          id: s.id,
          service_name: s.service_name,
          service_amount: s.service_amount,
          added_at: s.added_at,
          added_by: s.added_by ? `${s.added_by.first_name} ${s.added_by.last_name}` : 'Unknown'
        })),
        service_items: approvalCode.service_items.map(s => ({
          id: s.id,
          service_name: s.service_name,
          service_amount: s.service_amount,
          added_at: s.added_at,
          is_initial: s.is_initial,
          added_by: s.added_by ? `${s.added_by.first_name} ${s.added_by.last_name}` : null
        }))
      }
    })

  } catch (error) {
    console.error("Error fetching approval code details:", error)
    return NextResponse.json(
      { error: "Failed to fetch approval code details" },
      { status: 500 }
    )
  }
}
