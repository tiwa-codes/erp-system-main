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

    // Calculate in-patient metrics
    const [
      total_admissions,
      current_admissions,
      discharged_today
    ] = await Promise.all([
      prisma.inPatient.count(),
      prisma.inPatient.count({ where: { status: 'ADMITTED' } }),
      prisma.inPatient.count({
        where: {
          status: 'DISCHARGED',
          discharge_date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999))
          }
        }
      })
    ])

    // Calculate average length of stay
    const dischargedPatients = await prisma.inPatient.findMany({
      where: {
        status: 'DISCHARGED',
        discharge_date: { not: null }
      },
      select: {
        admission_date: true,
        discharge_date: true
      }
    })

    const average_length_of_stay = dischargedPatients.length > 0 
      ? Math.round(
          dischargedPatients.reduce((sum, patient) => {
            const admission = new Date(patient.admission_date)
            const discharge = new Date(patient.discharge_date!)
            const diffTime = Math.abs(discharge.getTime() - admission.getTime())
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            return sum + diffDays
          }, 0) / dischargedPatients.length
        )
      : 0

    return NextResponse.json({
      total_admissions,
      current_admissions,
      discharged_today,
      average_length_of_stay
    })
  } catch (error) {
    console.error('Error fetching in-patient metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch in-patient metrics' },
      { status: 500 }
    )
  }
}
