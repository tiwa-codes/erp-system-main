import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { resolveTelemedicinePatient } from "@/lib/telemedicine"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission
    const hasPermission = await checkPermission(session.user.role as any, "telemedicine", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const patientId = params.id
    const { enrolleeId: appointmentEnrolleeId } = await resolveTelemedicinePatient(patientId)

    // Fetch referrals for the patient
    const referrals = await prisma.referral.findMany({
      where: {
        appointment: {
          enrollee_id: appointmentEnrolleeId
        }
      },
      include: {
        appointment: {
          select: {
            scheduled_date: true,
            reason: true
          }
        }
      },
      orderBy: {
        created_at: "desc"
      }
    })

    return NextResponse.json({
      success: true,
      referrals
    })
  } catch (error) {
    console.error("Error fetching referrals:", error)
    return NextResponse.json(
      { error: "Failed to fetch referrals" },
      { status: 500 }
    )
  }
}
