import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Removed permission check - allowing all authenticated users to search enrollees
    // This is needed for telemedicine appointments and other modules

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20") // Increased default to show more results
    const search = searchParams.get("search") || ""
    const idOnly = (searchParams.get("id_only") || "").toLowerCase() === "true"

    const principalsWhere: any = {}
    const dependentsWhere: any = {}
    const trimmedSearch = search.trim()
    const matchesIdSegment = (enrolleeId: string | undefined, token: string) => {
      if (!enrolleeId) return false
      const lowerId = enrolleeId.toLowerCase()
      const lowerToken = token.toLowerCase()
      return lowerId.endsWith(`/${lowerToken}`) || lowerId.includes(`/${lowerToken}/`)
    }

    if (trimmedSearch) {
      // Search mode rules:
      // - Letters/mixed     → name fields (startsWith) only
      // - Digits ≤ 6        → ID contains only (last-3/4-digit ID look-up, NOT phone)
      // - Digits ≥ 7 or starts with '0' → phone-number search (contains, and also ID contains)
      const isDigitOnly = /^\d+$/.test(trimmedSearch)
      const isPhoneSearch = !idOnly && isDigitOnly && (trimmedSearch.length >= 7 || trimmedSearch.startsWith('0'))
      const isIdSearch = isDigitOnly && !isPhoneSearch

      if (isIdSearch) {
        const idSegmentSuffix = `/${trimmedSearch}`
        const idSegmentMiddle = `/${trimmedSearch}/`
        // Short digits: match IDs only
        principalsWhere.OR = [
          { enrollee_id: { endsWith: idSegmentSuffix, mode: "insensitive" } },
        ]
        dependentsWhere.OR = [
          { dependent_id: { contains: idSegmentMiddle, mode: "insensitive" } },
          { dependent_id: { endsWith: idSegmentSuffix, mode: "insensitive" } },
        ]
      } else if (isPhoneSearch) {
        // Long digits / 0-prefix: phone number search (also keep ID in case)
        principalsWhere.OR = [
          { phone_number: { contains: trimmedSearch, mode: "insensitive" } },
          { enrollee_id: { contains: trimmedSearch, mode: "insensitive" } },
        ]
        dependentsWhere.OR = [
          { phone_number: { contains: trimmedSearch, mode: "insensitive" } },
          { dependent_id: { contains: trimmedSearch, mode: "insensitive" } },
        ]
      } else {
        const terms = trimmedSearch.split(/\s+/).filter(t => t.length > 0)
        if (terms.length > 1) {
          // Multi-word: each term must match a name field
          principalsWhere.AND = terms.map(term => ({
            OR: [
              { first_name: { startsWith: term, mode: "insensitive" } },
              { last_name: { startsWith: term, mode: "insensitive" } },
            ]
          }))
          dependentsWhere.AND = terms.map(term => ({
            OR: [
              { first_name: { startsWith: term, mode: "insensitive" } },
              { last_name: { startsWith: term, mode: "insensitive" } },
            ]
          }))
        } else {
          principalsWhere.OR = [
            { first_name: { startsWith: trimmedSearch, mode: "insensitive" } },
            { last_name: { startsWith: trimmedSearch, mode: "insensitive" } },
          ]
          dependentsWhere.OR = [
            { first_name: { startsWith: trimmedSearch, mode: "insensitive" } },
            { last_name: { startsWith: trimmedSearch, mode: "insensitive" } },
          ]
        }
      }
    }

    // Fetch more than limit from each to ensure good mix after combining
    const fetchLimit = limit * 2 // Fetch double to have enough for good mix

    const [principals, dependents, principalsTotal, dependentsTotal] = await Promise.all([
      // Fetch principals
      prisma.principalAccount.findMany({
        where: principalsWhere,
        take: fetchLimit,
        orderBy: { first_name: 'asc' },
        include: {
          organization: {
            select: {
              id: true,
              name: true
            }
          },
          plan: {
            select: {
              id: true,
              name: true,
              assigned_bands: true,
              band_type: true
            }
          }
        }
      }),
      
      // Fetch dependents
      prisma.dependent.findMany({
        where: dependentsWhere,
        take: fetchLimit,
        orderBy: { first_name: 'asc' },
        include: {
          principal: {
            select: {
              id: true,
              enrollee_id: true,
              phone_number: true,
              email: true,
              organization: {
                select: {
                  id: true,
                  name: true
                }
              },
              plan: {
                select: {
                  id: true,
                  name: true,
                  assigned_bands: true,
                  band_type: true
                }
              }
            }
          }
        }
      }),
      
      // Count principals
      prisma.principalAccount.count({ where: principalsWhere }),
      
      // Count dependents
      prisma.dependent.count({ where: dependentsWhere })
    ])

    // Format principals - include band type from plan's assigned_bands
    const formattedPrincipals = principals.map(enrollee => {
      // Get band type from plan's assigned_bands (array) or legacy band_type field
      const bandType = enrollee.plan?.assigned_bands && enrollee.plan.assigned_bands.length > 0
        ? enrollee.plan.assigned_bands.join(', ')
        : enrollee.plan?.band_type || null
      
      return {
        id: enrollee.id,
        enrollee_id: enrollee.enrollee_id,
        name: `${enrollee.first_name} ${enrollee.last_name}`,
        plan: enrollee.plan?.name || 'No Plan',
        phone_number: enrollee.phone_number,
        region: enrollee.organization?.name || 'Individual',
        organization: enrollee.organization?.name || 'Individual',
        email: enrollee.email || '',
        status: enrollee.status,
        date_added: enrollee.created_at,
        type: 'Principal',
        band_type: bandType
      }
    })

    // Format dependents - include band type from principal's plan assigned_bands
    const formattedDependents = dependents.map(dependent => {
      // Get band type from principal's plan's assigned_bands (array) or legacy band_type field
      const bandType = dependent.principal.plan?.assigned_bands && dependent.principal.plan.assigned_bands.length > 0
        ? dependent.principal.plan.assigned_bands.join(', ')
        : dependent.principal.plan?.band_type || null
      
      return {
        id: dependent.id,
        enrollee_id: dependent.dependent_id,
        name: `${dependent.first_name} ${dependent.last_name}`,
        plan: dependent.principal.plan?.name || 'No Plan',
        phone_number: dependent.phone_number || dependent.principal.phone_number || '',
        organization: dependent.principal.organization?.name || 'Individual',
        region: dependent.principal.organization?.name || 'Individual',
        email: dependent.email || dependent.principal.email || '',
        status: dependent.status,
        date_added: dependent.created_at,
        type: 'Dependent',
        principal_account_id: dependent.principal.id,
        principal_id: dependent.principal.enrollee_id,
        band_type: bandType
      }
    })

    // Combine all enrollees
    let allEnrollees = [...formattedPrincipals, ...formattedDependents]

    // Post-process filter using same smart search logic as DB query
    if (trimmedSearch) {
      const lowerSearch = trimmedSearch.toLowerCase()
      const isDigitOnly = /^\d+$/.test(trimmedSearch)
      const isPhoneSearch = !idOnly && isDigitOnly && (trimmedSearch.length >= 7 || trimmedSearch.startsWith('0'))
      const isIdSearch = isDigitOnly && !isPhoneSearch
      allEnrollees = allEnrollees.filter(enrollee => {
        if (isIdSearch) {
          return matchesIdSegment(enrollee.enrollee_id, lowerSearch)
        } else if (isPhoneSearch) {
          return (
            enrollee.phone_number?.toLowerCase().includes(lowerSearch) ||
            enrollee.enrollee_id?.toLowerCase().includes(lowerSearch)
          )
        } else {
          return (
            enrollee.name?.toLowerCase().startsWith(lowerSearch) ||
            enrollee.plan?.toLowerCase().startsWith(lowerSearch) ||
            enrollee.region?.toLowerCase().startsWith(lowerSearch)
          )
        }
      })
    }

    // Sort all enrollees alphabetically
    allEnrollees = allEnrollees
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit) // Take only the requested limit after sorting

    const total = principalsTotal + dependentsTotal

    return NextResponse.json({
      success: true,
      enrollees: allEnrollees,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error("Error fetching enrollees:", error)
    return NextResponse.json(
      { error: "Failed to fetch enrollees" },
      { status: 500 }
    )
  }
}
