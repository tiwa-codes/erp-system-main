import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"
import { SpecialProviderStatus, ExchangeRateSource } from "@prisma/client"

const specialProviderUpdateSchema = z.object({
  organization_id: z.string().optional(),
  company_name: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  currency: z.string().length(3).optional(),
  exchange_rate_source: z.enum(["MANUAL", "AUTOMATIC_API", "FIXED_CONTRACT"]).optional(),
  contact_person_name: z.string().min(1).optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().min(1).optional(),
  company_address: z.string().min(1).optional(),
  website: z.string().url().optional().or(z.literal("")),
  business_registration_number: z.string().min(1).optional(),
  license_document_url: z.string().url().optional().or(z.literal("")),
  service_agreement_url: z.string().url().optional().or(z.literal("")),
  tax_id_number: z.string().optional(),
  bank_name: z.string().min(1).optional(),
  bank_country: z.string().min(1).optional(),
  account_number: z.string().min(1).optional(),
  swift_code: z.string().optional(),
  preferred_payment_method: z.string().min(1).optional(),
  service_details: z.any().optional(),
  default_exchange_rate: z.number().positive().optional(),
  internal_notes: z.string().optional().or(z.literal("")),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "special-risk", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const provider = await prisma.specialProvider.findUnique({
      where: { id: params.id },
      include: {
        approval_officer: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    })

    if (!provider) {
      return NextResponse.json({ error: "Special provider not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: provider,
    })
  } catch (error) {
    console.error("Error fetching special provider:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch special provider",
      },
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
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canEdit = await checkPermission(session.user.role as any, "special-risk", "edit")
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const provider = await prisma.specialProvider.findUnique({
      where: { id: params.id },
    })

    if (!provider) {
      return NextResponse.json({ error: "Special provider not found" }, { status: 404 })
    }

    const body = await request.json()
    
    // Log the incoming body for debugging
    console.log("PUT request body:", JSON.stringify(body, null, 2))
    
    let validatedData
    try {
      validatedData = specialProviderUpdateSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors)
        return NextResponse.json(
          {
            success: false,
            error: "Validation failed",
            details: error.errors,
          },
          { status: 400 }
        )
      }
      throw error
    }

    // Check if this is a notes-only update for approved providers
    const isNotesOnlyUpdate = Object.keys(validatedData).length === 1 && validatedData.internal_notes !== undefined
    
    // Cannot edit approved providers except for notes
    if (provider.status === SpecialProviderStatus.APPROVED && !isNotesOnlyUpdate) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot edit approved provider. Only notes can be updated.",
        },
        { status: 400 }
      )
    }

    const updateData: any = {}
    Object.keys(validatedData).forEach((key) => {
      if (validatedData[key as keyof typeof validatedData] !== undefined) {
        if (key === "website" || key === "license_document_url" || key === "service_agreement_url") {
          updateData[key] = validatedData[key as keyof typeof validatedData] || null
        } else if (key === "currency") {
          updateData[key] = (validatedData[key] as string).toUpperCase()
        } else if (key === "organization_id") {
          updateData[key] = validatedData[key as keyof typeof validatedData] || null
        } else if (key === "internal_notes") {
          // Allow empty string for internal_notes
          updateData[key] = validatedData[key as keyof typeof validatedData] ?? null
        } else {
          updateData[key] = validatedData[key as keyof typeof validatedData]
        }
      }
    })

    const updatedProvider = await prisma.specialProvider.update({
      where: { id: params.id },
      data: updateData,
      include: {
        approval_officer: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "SPECIAL_PROVIDER_UPDATE",
        resource: "special_provider",
        resource_id: updatedProvider.id,
        old_values: provider,
        new_values: updatedProvider,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedProvider,
    })
  } catch (error) {
    console.error("Error updating special provider:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update special provider",
      },
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
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canDelete = await checkPermission(session.user.role as any, "special-risk", "delete")
    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const provider = await prisma.specialProvider.findUnique({
      where: { id: params.id },
    })

    if (!provider) {
      return NextResponse.json({ error: "Special provider not found" }, { status: 404 })
    }

    // Soft delete - set status to REJECTED
    const updatedProvider = await prisma.specialProvider.update({
      where: { id: params.id },
      data: {
        status: SpecialProviderStatus.REJECTED,
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "SPECIAL_PROVIDER_DELETE",
        resource: "special_provider",
        resource_id: updatedProvider.id,
        old_values: { status: provider.status },
        new_values: { status: updatedProvider.status },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedProvider,
    })
  } catch (error) {
    console.error("Error deleting special provider:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete special provider",
      },
      { status: 500 }
    )
  }
}

