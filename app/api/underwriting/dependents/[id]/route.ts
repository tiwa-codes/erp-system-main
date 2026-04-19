import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const updateDependentSchema = z.object({
  first_name: z.string().min(1, "First name is required").optional(),
  last_name: z.string().min(1, "Last name is required").optional(),
  middle_name: z.string().optional(),
  date_of_birth: z.string().optional(),
  relationship: z.enum(["SPOUSE", "SON", "DAUGHTER", "PARENT", "SIBLING", "OTHER", "EXTRA_DEPENDENT"]).optional().or(z.literal("").transform(() => undefined)),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().or(z.literal("").transform(() => undefined)),
  phone_number: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  residential_address: z.string().optional(),
  state: z.string().optional(),
  lga: z.string().optional(),
  region: z.string().optional(),
  profile_picture: z.string().optional(),
  old_utilization: z.coerce.number().min(0).optional(),
  preferred_provider_id: z.string().optional().or(z.literal("").transform(() => undefined)),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional().or(z.literal("").transform(() => undefined)),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Allow access if user has underwriting view OR telemedicine view permissions
    // Telemedicine users need to view dependents for patient timeline and appointments
    const canViewUnderwriting = await checkPermission(session.user.role as any, 'underwriting', 'view')
    const canViewTelemedicine = await checkPermission(session.user.role as any, 'telemedicine', 'view')
    
    if (!canViewUnderwriting && !canViewTelemedicine) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const dependent = await prisma.dependent.findUnique({
      where: { id: params.id },
      include: {
        principal: {
          include: {
            organization: {
              select: { id: true, name: true }
            },
            plan: {
              select: { id: true, name: true }
            },
            claims: {
              select: {
                id: true,
                claim_number: true,
                amount: true,
                status: true,
                submitted_at: true,
                provider: {
                  select: {
                    id: true,
                    facility_name: true,
                    hcp_code: true,
                  },
                },
              },
              orderBy: {
                submitted_at: 'desc',
              },
              take: 10,
            },
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
        },
      }
    })

    if (!dependent) {
      return NextResponse.json(
        { error: "Dependent not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(dependent)
  } catch (error) {
    console.error("Error fetching dependent:", error)
    return NextResponse.json(
      { error: "Failed to fetch dependent" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission
    const canEdit = await checkPermission(session.user.role as any, 'underwriting', 'edit')
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateDependentSchema.parse(body)

    // Check if dependent exists
    const existingDependent = await prisma.dependent.findUnique({
      where: { id: params.id }
    })

    if (!existingDependent) {
      return NextResponse.json(
        { error: "Dependent not found" },
        { status: 404 }
      )
    }

    const updateData: any = { ...validatedData }
    
    // Filter out undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key]
      }
    })
    
    if (validatedData.date_of_birth) {
      updateData.date_of_birth = new Date(validatedData.date_of_birth)
    }
    
    if (validatedData.email === "") {
      updateData.email = null
    }

    if (validatedData.preferred_provider_id === "") {
      updateData.preferred_provider_id = null
    }

    const dependent = await prisma.dependent.update({
      where: { id: params.id },
      data: updateData,
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

    return NextResponse.json(dependent)
  } catch (error) {
    console.error("Error updating dependent:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to update dependent" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission
    const canDelete = await checkPermission(session.user.role as any, 'underwriting', 'delete')
    if (!canDelete) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if dependent exists
    const existingDependent = await prisma.dependent.findUnique({
      where: { id: params.id }
    })

    if (!existingDependent) {
      return NextResponse.json(
        { error: "Dependent not found" },
        { status: 404 }
      )
    }

    await prisma.dependent.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: "Dependent deleted successfully" })
  } catch (error) {
    console.error("Error deleting dependent:", error)
    return NextResponse.json(
      { error: "Failed to delete dependent" },
      { status: 500 }
    )
  }
}
