import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { ApprovalCodeStatus } from "@prisma/client"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const hasPermission = await checkPermission(session.user.role as any, "call-centre", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const enrolleeId = params.id

    if (!enrolleeId) {
      return NextResponse.json({ error: "Enrollee ID is required" }, { status: 400 })
    }

    // Find previous approval codes (encounters) for this enrollee
    const previousEncounters = await prisma.approvalCode.findMany({
      where: {
        enrollee_id: enrolleeId,
        status: {
          in: [ApprovalCodeStatus.APPROVED, ApprovalCodeStatus.PARTIAL]
        }
      },
      select: {
        id: true,
        approval_code: true,
        hospital: true,
        diagnosis: true,
        amount: true,
        status: true,
        created_at: true,
        services: true,
        admission_required: true,
        generated_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: {
        created_at: 'desc' // Most recent first
      },
      take: 20 // Limit to last 20 encounters
    })

    // Transform the data for the frontend
    const formattedEncounters = previousEncounters.map(encounter => {
      let services = []
      try {
        services = JSON.parse(encounter.services || '[]')
      } catch {
        services = []
      }

      return {
        id: encounter.id,
        encounter_code: encounter.approval_code,
        hospital: encounter.hospital,
        diagnosis: encounter.diagnosis || 'No diagnosis provided',
        amount: encounter.amount,
        status: encounter.status,
        admission_required: encounter.admission_required,
        created_at: encounter.created_at,
        services: services,
        service_count: services.length,
        generated_by: encounter.generated_by ? 
          `${encounter.generated_by.first_name} ${encounter.generated_by.last_name}` : 
          'Unknown'
      }
    })

    return NextResponse.json({
      success: true,
      encounters: formattedEncounters,
      total: formattedEncounters.length
    })

  } catch (error) {
    console.error("Error fetching previous encounters:", error)
    return NextResponse.json(
      { error: "Failed to fetch previous encounters" },
      { status: 500 }
    )
  }
}
