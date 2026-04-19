import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission to view reports
    const canView = await checkPermission(session.user.role as any, 'reports', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Build date filter for appointments
    const appointmentWhereClause: any = {}
    if (from) {
      appointmentWhereClause.scheduled_date = { gte: new Date(from) }
    }
    if (to) {
      // Add one day to include the entire end date
      const endDate = new Date(to)
      endDate.setHours(23, 59, 59, 999)
      appointmentWhereClause.scheduled_date = {
        ...(appointmentWhereClause.scheduled_date || {}),
        lte: endDate
      }
    }

    // Get all telemedicine appointments with enrollee information
    const appointments = await prisma.telemedicineAppointment.findMany({
      where: appointmentWhereClause,
      select: {
        id: true,
        notes: true,
        enrollee: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true,
            state: true,
            organization: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    const parseDependentIdentifiers = (notes: string | null) => {
      if (!notes) {
        return null
      }

      const dependentIdMatch = notes.match(/DEPENDENT_ID\s*:\s*([^|]+)/i)
      const dependentEnrolleeIdMatch = notes.match(/DEPENDENT_ENROLLEE_ID\s*:\s*([^|]+)/i)

      const dependentId = dependentIdMatch?.[1]?.trim()
      const dependentEnrolleeId = dependentEnrolleeIdMatch?.[1]?.trim()

      if (!dependentId && !dependentEnrolleeId) {
        return null
      }

      return {
        dependentId,
        dependentEnrolleeId
      }
    }

    // Preload dependents referenced in notes to avoid per-appointment queries
    const dependentIdSet = new Set<string>()
    const dependentEnrolleeIdSet = new Set<string>()
    const appointmentDependents = new Map<string, { dependentId?: string; dependentEnrolleeId?: string }>()

    for (const appointment of appointments) {
      const identifiers = parseDependentIdentifiers(appointment.notes)
      if (identifiers) {
        appointmentDependents.set(appointment.id, identifiers)
        if (identifiers.dependentId) {
          dependentIdSet.add(identifiers.dependentId)
        }
        if (identifiers.dependentEnrolleeId) {
          dependentEnrolleeIdSet.add(identifiers.dependentEnrolleeId)
        }
      }
    }

    const dependentOrConditions: any[] = []
    if (dependentIdSet.size > 0) {
      dependentOrConditions.push({ id: { in: Array.from(dependentIdSet) } })
    }
    if (dependentEnrolleeIdSet.size > 0) {
      dependentOrConditions.push({ dependent_id: { in: Array.from(dependentEnrolleeIdSet) } })
    }

    const dependents = dependentOrConditions.length
      ? await prisma.dependent.findMany({
          where: { OR: dependentOrConditions },
          select: {
            id: true,
            dependent_id: true,
            state: true,
            principal: {
              select: {
                organization: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        })
      : []

    const dependentsByIdentifier = new Map<string, (typeof dependents)[number]>()
    for (const dependent of dependents) {
      dependentsByIdentifier.set(dependent.id, dependent)
      if (dependent.dependent_id) {
        dependentsByIdentifier.set(dependent.dependent_id, dependent)
      }
    }

    // Process appointments to extract unique patients (principals and dependents)
    const uniquePrincipals = new Map<string, any>()
    const uniqueDependents = new Map<string, any>()
    const organizationMap = new Map<string, Set<string>>()
    const stateMap = new Map<string, Set<string>>()

    for (const appointment of appointments) {
      // Check if this appointment is for a dependent
      const dependentIdentifiers = appointmentDependents.get(appointment.id)
      const dependentRecord =
        (dependentIdentifiers?.dependentId && dependentsByIdentifier.get(dependentIdentifiers.dependentId)) ||
        (dependentIdentifiers?.dependentEnrolleeId && dependentsByIdentifier.get(dependentIdentifiers.dependentEnrolleeId))

      if (dependentIdentifiers) {
        const dependentKey =
          dependentRecord?.id ||
          dependentIdentifiers.dependentId ||
          dependentIdentifiers.dependentEnrolleeId ||
          appointment.id

        if (!uniqueDependents.has(dependentKey)) {
          uniqueDependents.set(dependentKey, dependentRecord || { id: dependentKey })

          const orgName =
            dependentRecord?.principal.organization?.name ||
            appointment.enrollee.organization?.name ||
            'Unknown Organization'

          if (!organizationMap.has(orgName)) {
            organizationMap.set(orgName, new Set())
          }
          organizationMap.get(orgName)!.add(`dep-${dependentKey}`)

          const dependentState = dependentRecord?.state || appointment.enrollee.state
          if (dependentState) {
            if (!stateMap.has(dependentState)) {
              stateMap.set(dependentState, new Set())
            }
            stateMap.get(dependentState)!.add(`dep-${dependentKey}`)
          }
        }
      } else {
        // This is a principal appointment
        const principalId = appointment.enrollee.id
        if (!uniquePrincipals.has(principalId)) {
          uniquePrincipals.set(principalId, appointment.enrollee)

          // Track by organization
          const orgName = appointment.enrollee.organization?.name || 'Unknown Organization'
          if (!organizationMap.has(orgName)) {
            organizationMap.set(orgName, new Set())
          }
          organizationMap.get(orgName)!.add(`prin-${principalId}`)

          // Track by state
          if (appointment.enrollee.state) {
            if (!stateMap.has(appointment.enrollee.state)) {
              stateMap.set(appointment.enrollee.state, new Set())
            }
            stateMap.get(appointment.enrollee.state)!.add(`prin-${principalId}`)
          }
        }
      }
    }

    // Calculate total unique patients
    const totalPatients = uniquePrincipals.size + uniqueDependents.size

    // Convert organization map to array with counts
    const patientsByOrganization = Array.from(organizationMap.entries()).map(([orgName, patientSet]) => ({
      organization_name: orgName,
      patient_count: patientSet.size
    })).sort((a, b) => b.patient_count - a.patient_count)

    // Convert state map to array with counts
    const patientsByState = Array.from(stateMap.entries()).map(([state, patientSet]) => ({
      state: state,
      patient_count: patientSet.size
    })).sort((a, b) => b.patient_count - a.patient_count)

    return NextResponse.json({
      success: true,
      totalPatients,
      patientsByOrganization,
      patientsByState
    })
  } catch (error) {
    console.error('Error fetching telemedicine statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}
