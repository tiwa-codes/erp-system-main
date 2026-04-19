import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"
import { SpecialProviderType, SpecialProviderStatus, ExchangeRateSource } from "@prisma/client"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

// Base schema for all provider types
const baseSpecialProviderSchema = z.object({
  organization_type: z.enum(["FOREIGN_PROVIDER", "AMBULANCE_COMPANY", "LOGISTICS_COMPANY"]),
  company_name: z.string().min(1, "Company name is required"),
  country: z.string().min(1, "Country is required"),
  currency: z.string().length(3, "Currency must be 3 characters"),
  exchange_rate_source: z.enum(["MANUAL", "AUTOMATIC_API", "FIXED_CONTRACT"]),
  contact_person_name: z.string().min(1, "Contact person name is required"),
  contact_email: z.string().email("Invalid email address"),
  contact_phone: z.string().min(1, "Contact phone is required"),
  company_address: z.string().min(1, "Company address is required"),
  website: z.string().url().optional().or(z.literal("")),
  business_registration_number: z.string().min(1, "Business registration number is required"),
  license_document_url: z.string().url().optional().or(z.literal("")),
  service_agreement_url: z.string().url().optional().or(z.literal("")),
  tax_id_number: z.string().optional(),
  bank_name: z.string().min(1, "Bank name is required"),
  bank_country: z.string().min(1, "Bank country is required"),
  account_number: z.string().min(1, "Account number is required"),
  swift_code: z.string().optional(),
  preferred_payment_method: z.string().min(1, "Preferred payment method is required"),
  service_details: z.any(), // JSON - varies by type
  default_exchange_rate: z.number().positive().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canView = await checkPermission(session.user.role as any, "special-risk", "view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") as SpecialProviderType | null
    const status = searchParams.get("status") as SpecialProviderStatus | null
    const country = searchParams.get("country")
    const search = searchParams.get("search")?.trim()
    const page = parseInt(searchParams.get("page") || "1")
    const limit = Math.min(parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT)), MAX_LIMIT)
    const skip = (page - 1) * limit

    const where: any = {}

    if (type) {
      where.organization_type = type
    }

    if (status) {
      where.status = status
    }

    if (country) {
      where.country = country
    }

    if (search) {
      where.OR = [
        { company_name: { contains: search, mode: "insensitive" } },
        { provider_id: { contains: search, mode: "insensitive" } },
        { contact_email: { contains: search, mode: "insensitive" } },
        { contact_phone: { contains: search, mode: "insensitive" } },
      ]
    }

    const [providers, total] = await Promise.all([
      prisma.specialProvider.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
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
      }),
      prisma.specialProvider.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        providers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error("Error fetching special providers:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch special providers",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canAdd = await checkPermission(session.user.role as any, "special-risk", "add")
    if (!canAdd) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = baseSpecialProviderSchema.parse(body)

    // Generate unique provider_id
    const lastProvider = await prisma.specialProvider.findFirst({
      orderBy: { provider_id: "desc" },
    })

    const nextProviderId = lastProvider
      ? (parseInt(lastProvider.provider_id) + 1).toString()
      : "1"

    // Validate service_details based on organization_type
    const serviceDetails = validatedData.service_details
    if (!serviceDetails || typeof serviceDetails !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Service details are required and must be an object",
        },
        { status: 400 }
      )
    }

    // Type-specific validation
    if (validatedData.organization_type === "FOREIGN_PROVIDER") {
      if (!serviceDetails.hospital_type || !serviceDetails.available_services) {
        return NextResponse.json(
          {
            success: false,
            error: "Foreign provider must have hospital_type and available_services",
          },
          { status: 400 }
        )
      }
    } else if (validatedData.organization_type === "AMBULANCE_COMPANY") {
      if (!serviceDetails.coverage_area || !serviceDetails.service_types) {
        return NextResponse.json(
          {
            success: false,
            error: "Ambulance company must have coverage_area and service_types",
          },
          { status: 400 }
        )
      }
    } else if (validatedData.organization_type === "LOGISTICS_COMPANY") {
      if (!serviceDetails.service_type || !serviceDetails.coverage_area) {
        return NextResponse.json(
          {
            success: false,
            error: "Logistics company must have service_type and coverage_area",
          },
          { status: 400 }
        )
      }
    }

    const provider = await prisma.specialProvider.create({
      data: {
        provider_id: nextProviderId,
        organization_type: validatedData.organization_type,
        company_name: validatedData.company_name,
        country: validatedData.country,
        currency: validatedData.currency.toUpperCase(),
        exchange_rate_source: validatedData.exchange_rate_source,
        contact_person_name: validatedData.contact_person_name,
        contact_email: validatedData.contact_email,
        contact_phone: validatedData.contact_phone,
        company_address: validatedData.company_address,
        website: validatedData.website || null,
        business_registration_number: validatedData.business_registration_number,
        license_document_url: validatedData.license_document_url || null,
        service_agreement_url: validatedData.service_agreement_url || null,
        tax_id_number: validatedData.tax_id_number || null,
        bank_name: validatedData.bank_name,
        bank_country: validatedData.bank_country,
        account_number: validatedData.account_number,
        swift_code: validatedData.swift_code || null,
        preferred_payment_method: validatedData.preferred_payment_method,
        service_details: serviceDetails,
        default_exchange_rate: validatedData.default_exchange_rate || null,
        status: SpecialProviderStatus.DRAFT,
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "SPECIAL_PROVIDER_CREATE",
        resource: "special_provider",
        resource_id: provider.id,
        new_values: {
          provider_id: provider.provider_id,
          organization_type: provider.organization_type,
          company_name: provider.company_name,
          country: provider.country,
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: provider,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating special provider:", error)
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
        error: error instanceof Error ? error.message : "Failed to create special provider",
      },
      { status: 500 }
    )
  }
}








