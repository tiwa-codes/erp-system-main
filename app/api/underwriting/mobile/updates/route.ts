import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 100

const clampInteger = (
  value: string | null,
  fallback: number,
  min = 1,
  max = MAX_LIMIT
): number => {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(
      session.user.role as any,
      "underwriting",
      "view"
    )

    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim()
    const statusParam = searchParams.get("status")
    const page = clampInteger(searchParams.get("page"), 1)
    const limit = clampInteger(searchParams.get("limit"), DEFAULT_LIMIT)

    // Determine which statuses to fetch
    let statusFilter: any = "PENDING"
    if (statusParam === "active") {
      statusFilter = "APPROVED"
    } else if (statusParam === "all") {
      statusFilter = { in: ["PENDING", "APPROVED", "REJECTED"] }
    }

    // Build search filter
    const searchFilter = search ? {
      OR: [
        { first_name: { contains: search, mode: "insensitive" } },
        { last_name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { enrollee_id: { contains: search, mode: "insensitive" } },
      ]
    } : {}

    // Fetch pending principal registrations
    const [principalRegistrations, principalRegistrationsTotal] = await Promise.all([
      prisma.principalRegistration.findMany({
        where: {
          status: statusFilter,
          ...searchFilter,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { submitted_at: "desc" },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          plan: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.principalRegistration.count({
        where: {
          status: statusFilter,
          ...searchFilter,
        },
      }),
    ])

    // Fetch pending dependent registrations
    const [dependentRegistrations, dependentRegistrationsTotal] = await Promise.all([
      prisma.dependentRegistration.findMany({
        where: {
          status: statusFilter,
          ...(search ? {
            OR: [
              { first_name: { contains: search, mode: "insensitive" } },
              { last_name: { contains: search, mode: "insensitive" } },
            ]
          } : {}),
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { submitted_at: "desc" },
        include: {
          principal_registration: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      }),
      prisma.dependentRegistration.count({
        where: {
          status: statusFilter,
          ...(search ? {
            OR: [
              { first_name: { contains: search, mode: "insensitive" } },
              { last_name: { contains: search, mode: "insensitive" } },
            ]
          } : {}),
        },
      }),
    ])

    // Fetch mobile updates (target: PROVIDER and PRINCIPAL)
    let mobileUpdates: any[] = []
    let mobileUpdatesTotal = 0

    try {
      const [updates, total] = await Promise.all([
        prisma.mobileUpdate.findMany({
          where: {
            status: statusFilter === "PENDING" ? "PENDING" : { in: ["PENDING", "APPROVED", "REJECTED"] },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { created_at: "desc" },
        }),
        prisma.mobileUpdate.count({
          where: {
            status: statusFilter === "PENDING" ? "PENDING" : { in: ["PENDING", "APPROVED", "REJECTED"] },
          },
        }),
      ])
      mobileUpdates = updates
      mobileUpdatesTotal = total

      // Enrich mobileUpdates with provider or principal details
      const providerIds = mobileUpdates.filter(u => u.target === "PROVIDER").map(u => u.target_id).filter(Boolean) as string[]
      const principalIds = mobileUpdates.filter(u => u.target === "PRINCIPAL").map(u => u.target_id).filter(Boolean) as string[]

      const [relatedProviders, relatedPrincipals] = await Promise.all([
        prisma.provider.findMany({
          where: { id: { in: providerIds } },
          select: { id: true, facility_name: true }
        }),
        prisma.principalAccount.findMany({
          where: { id: { in: principalIds } },
          select: { id: true, first_name: true, last_name: true, enrollee_id: true }
        })
      ])

      const providerMap = new Map(relatedProviders.map(p => [p.id, p]))
      const principalMap = new Map(relatedPrincipals.map(p => [p.id, p]))

      mobileUpdates = mobileUpdates.map(u => ({
        ...u,
        provider: u.target === "PROVIDER" ? providerMap.get(u.target_id!) : null,
        principal: u.target === "PRINCIPAL" ? principalMap.get(u.target_id!) : null,
      }))

    } catch (error) {
      console.log("Error fetching MobileUpdates:", error)
    }

    // Map principal registrations to match expected format
    const principals = principalRegistrations.map((reg) => ({
      id: reg.id,
      enrollee_id: reg.id, // Use registration ID temporarily
      first_name: reg.first_name,
      last_name: reg.last_name,
      email: reg.email,
      phone_number: reg.phone_number,
      organization: reg.organization,
      plan: reg.plan,
      status: reg.status,
      created_at: reg.submitted_at,
    }))

    // Map dependent registrations to match expected format
    const dependents = dependentRegistrations.map((dep) => ({
      id: dep.id,
      dependent_id: dep.id,
      first_name: dep.first_name,
      last_name: dep.last_name,
      relationship: dep.relationship,
      principal: dep.principal_registration,
      status: dep.status,
      created_at: dep.submitted_at,
    }))

    const response = {
      principals: {
        items: principals,
        pagination: {
          total: principalRegistrationsTotal,
          page,
          limit,
          pages: Math.max(1, Math.ceil(principalRegistrationsTotal / limit)),
        },
      },
      dependents: {
        items: dependents,
        pagination: {
          total: dependentRegistrationsTotal,
          page,
          limit,
          pages: Math.max(1, Math.ceil(dependentRegistrationsTotal / limit)),
        },
      },
      providerUpdates: {
        items: mobileUpdates,
        pagination: {
          total: mobileUpdatesTotal,
          page,
          limit,
          pages: Math.max(1, Math.ceil(mobileUpdatesTotal / limit)),
        },
      },
    }

    return NextResponse.json({
      success: true,
      data: response,
    })
  } catch (error) {
    console.error("Error fetching underwriting mobile updates:", error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch underwriting mobile updates",
      },
      { status: 500 }
    )
  }
}