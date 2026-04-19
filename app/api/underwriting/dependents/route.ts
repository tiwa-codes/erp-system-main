import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"
import { validateCoverageRule } from "@/lib/underwriting/coverage"

const createDependentSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  middle_name: z.string().optional(),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  relationship: z.enum(["SPOUSE", "SON", "DAUGHTER", "PARENT", "SIBLING", "OTHER", "EXTRA_DEPENDENT"]),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  phone_number: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  residential_address: z.string().optional(),
  state: z.string().optional(),
  lga: z.string().optional(),
  region: z.string().optional(),
  profile_picture: z.string().optional(),
  preferred_provider_id: z.string().optional(),
  principal_id: z.string().min(1, "Principal account is required"),
})


export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission
    const canView = await checkPermission(session.user.role as any, 'underwriting', 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const organization = searchParams.get("organization") || ""
    const plan = searchParams.get("plan") || ""
    const status = searchParams.get("status") || ""

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}

    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: "insensitive" } },
        { last_name: { contains: search, mode: "insensitive" } },
        { dependent_id: { contains: search, mode: "insensitive" } },
        { phone_number: { contains: search, mode: "insensitive" } },
      ]
    }

    if (status && status !== "all") {
      where.status = status
    }

    if (organization && organization !== "all") {
      where.principal = {
        ...(where.principal || {}),
        organization_id: organization,
      }
    }

    if (plan && plan !== "all") {
      where.principal = {
        ...(where.principal || {}),
        plan_id: plan,
      }
    }

    const extractTrailingSerial = (dependentId?: string | null) => {
      if (!dependentId) return -1
      const match = dependentId.match(/(\d+)\s*$/)
      return match ? parseInt(match[1], 10) : -1
    }

    const [allDependents, total] = await Promise.all([
      prisma.dependent.findMany({
        where,
        orderBy: { created_at: "desc" },
        include: {
          principal: {
            include: {
              organization: {
                select: { id: true, name: true }
              },
              plan: {
                select: { id: true, name: true }
              }
            }
          },
          preferred_provider: {
            select: {
              id: true,
              facility_name: true,
              facility_type: true,
              hcp_code: true
            }
          },
          created_by: {
            select: { id: true, first_name: true, last_name: true }
          }
        }
      }),
      prisma.dependent.count({ where })
    ])

    const dependents = [...allDependents]
      .sort((a, b) => {
        const serialA = extractTrailingSerial(a.dependent_id)
        const serialB = extractTrailingSerial(b.dependent_id)

        if (serialB !== serialA) return serialB - serialA

        const timeA = new Date(a.created_at).getTime()
        const timeB = new Date(b.created_at).getTime()
        if (timeB !== timeA) return timeB - timeA

        return String(b.dependent_id || "").localeCompare(String(a.dependent_id || ""))
      })
      .slice(skip, skip + limit)

    return NextResponse.json({
      dependents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching dependents:", error)
    return NextResponse.json(
      { error: "Failed to fetch dependents" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission
    const canCreate = await checkPermission(session.user.role as any, 'underwriting', 'add')
    if (!canCreate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createDependentSchema.parse(body)

    // Verify principal account exists and get enrollee_id
    const principal = await prisma.principalAccount.findUnique({
      where: { id: validatedData.principal_id },
      select: {
        id: true,
        enrollee_id: true,
        plan_id: true,
        date_of_birth: true,
        dependents: {
          select: {
            relationship: true,
            date_of_birth: true
          }
        }
      }
    })

    if (!principal) {
      return NextResponse.json(
        { error: "Principal account not found" },
        { status: 400 }
      )
    }

    if (!principal.plan_id) {
      return NextResponse.json(
        { error: "Principal account does not have an assigned plan" },
        { status: 400 }
      )
    }

    const coverageResult = await validateCoverageRule({
      planId: principal.plan_id,
      principalDateOfBirth: principal.date_of_birth?.toISOString(),
      dependents: [{
        relationship: validatedData.relationship,
        dateOfBirth: validatedData.date_of_birth,
      }],
      existingDependents: principal.dependents.map(dep => ({
        relationship: dep.relationship,
        dateOfBirth: dep.date_of_birth?.toISOString()
      }))
    })

    if (!coverageResult.valid) {
      return NextResponse.json(
        { error: coverageResult.reason },
        { status: 400 }
      )
    }

    // Generate dependent ID based on principal's enrollee_id and relationship
    // Format: CJH/TB/001/1 (spouse), CJH/TB/001/2 (child), etc.
    const existingDependents = await prisma.dependent.findMany({
      where: { principal_id: validatedData.principal_id },
      orderBy: { created_at: 'desc' },
      select: { dependent_id: true }
    })

    let nextSuffix = 1
    if (existingDependents.length > 0) {
      // Extract the highest suffix number from existing dependents
      const suffixes = existingDependents
        .map(dep => {
          const parts = dep.dependent_id.split('/')
          if (parts.length === 4) {
            // Handle both "/1" and "/D01" formats by stripping non-numeric characters
            const numStr = parts[3].replace(/\D/g, '')
            const num = parseInt(numStr)
            return isNaN(num) ? 0 : num
          }
          return 0
        })
        .filter(num => num > 0)

      if (suffixes.length > 0) {
        nextSuffix = Math.max(...suffixes) + 1
      }
    }

    // Format: CJH/TB/001/01 (spouse), CJH/TB/001/02 (child), etc.
    const suffix = nextSuffix.toString().padStart(2, '0')
    const dependentId = `${principal.enrollee_id}/${suffix}`

    const dependent = await prisma.dependent.create({
      data: {
        ...validatedData,
        dependent_id: dependentId,
        date_of_birth: new Date(validatedData.date_of_birth),
        email: validatedData.email || null,
        preferred_provider_id: validatedData.preferred_provider_id || null,
        created_by_id: session.user.id
      },
      include: {
        principal: {
          include: {
            organization: {
              select: { id: true, name: true }
            },
            plan: {
              select: { id: true, name: true }
            }
          }
        },
        preferred_provider: {
          select: {
            id: true,
            facility_name: true,
            facility_type: true,
            hcp_code: true
          }
        },
        created_by: {
          select: { id: true, first_name: true, last_name: true }
        }
      }
    })

    return NextResponse.json(dependent, { status: 201 })
  } catch (error) {
    console.error("Error creating dependent:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to create dependent" },
      { status: 500 }
    )
  }
}
