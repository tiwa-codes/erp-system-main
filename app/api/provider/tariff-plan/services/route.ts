import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { convertCurrencyAndLock } from "@/lib/currency"
import { RateType } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const hasPermission = await checkPermission(session.user.role as any, "provider", "manage_tariff_plan")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const providerId = searchParams.get('providerId')
    const status = searchParams.get('status')

    let uploadedTariffExists = true
    if (providerId) {
      const providerExists = await prisma.provider.findUnique({
        where: { id: providerId },
        select: { id: true },
      })

      if (!providerExists) {
        return NextResponse.json(
          { error: "Provider account link is invalid. Please contact Provider Management." },
          { status: 404 }
        )
      }

      const uploadedTariff = await prisma.providerTariffFile.findUnique({
        where: { provider_id: providerId },
        select: { id: true },
      })

      uploadedTariffExists = Boolean(uploadedTariff)
    }

    // Build where clause
    const where: any = {}

    if (status) {
      where.status = status
    }

    if (providerId) {
      where.provider_id = providerId
    }

    if (category) {
      where.category_id = category
    }

    if (search) {
      where.OR = [
        { service_name: { contains: search, mode: 'insensitive' } },
        { service_id: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Fetch tariff plan services from database
    const services = await prisma.tariffPlanService.findMany({
      where,
      orderBy: {
        created_at: 'desc'
      }
    })

    // Keep legacy provider tariffs visible even when an old provider has no tariff file record.
    // Only show explicit "no tariff uploaded" state when both file and services are absent.
    if (providerId && !uploadedTariffExists && services.length === 0) {
      return NextResponse.json({
        success: true,
        services: [],
        count: 0,
        message: "No tariff uploaded for this provider yet.",
      })
    }

    return NextResponse.json({
      success: true,
      services,
      count: services.length
    })

  } catch (error) {
    console.error("Error fetching tariff plan services:", error)
    return NextResponse.json(
      { error: "Failed to fetch tariff plan services" },
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

    const hasPermission = await checkPermission(session.user.role as any, "provider", "manage_tariff_plan")
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const {
      service_id,
      service_name,
      category_id,
      price,
      is_primary,
      is_secondary,
      provider_id
    } = body

    // Validate required fields
    if (!service_id || !service_name || !category_id || price === undefined || !provider_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Get or create tariff plan for this provider
    let tariffPlan = await prisma.tariffPlan.findFirst({
      where: {
        provider_id: provider_id,
      },
      orderBy: {
        created_at: "desc",
      },
    })

    if (!tariffPlan) {
      // Create a new draft tariff plan
      tariffPlan = await prisma.tariffPlan.create({
        data: {
          provider_id: provider_id,
          status: "DRAFT",
          version: 1,
        },
      })
    }

    // Only allow adding services if tariff plan is in DRAFT or REJECTED status
    if (tariffPlan.status !== "DRAFT" && tariffPlan.status !== "REJECTED") {
      return NextResponse.json(
        { error: "Cannot add services. Tariff plan must be in DRAFT or REJECTED status" },
        { status: 400 }
      )
    }

    // Check if provider is foreign and handle currency conversion
    let originalCurrency = "NGN"
    let originalPrice: number | null = null
    let exchangeRateUsed: number | null = null
    let exchangeRateDate: Date | null = null
    let servicePrice = Number(price)

    // Get provider to check if it's a foreign provider
    const provider = await prisma.provider.findUnique({
      where: { id: provider_id },
      select: { provider_id: true },
    })

    if (provider) {
      // Check if there's a SpecialProvider with matching numeric provider_id
      const specialProvider = await prisma.specialProvider.findFirst({
        where: {
          provider_id: provider.provider_id,
          status: "APPROVED",
        },
      })

      if (specialProvider && specialProvider.currency !== "NGN") {
        originalCurrency = specialProvider.currency
        originalPrice = servicePrice

        // Convert to NGN and lock the rate
        const rateType = RateType.MID_MARKET // Default to mid-market
        const conversion = await convertCurrencyAndLock(
          servicePrice,
          specialProvider.currency,
          "NGN",
          rateType
        )

        if (conversion) {
          servicePrice = conversion.convertedAmount
          exchangeRateUsed = conversion.rate
          exchangeRateDate = new Date()
        } else {
          console.error(
            `Failed to convert currency for tariff service. Provider currency: ${specialProvider.currency}`
          )
          // Continue with original price if conversion fails
        }
      }
    }

    // Create tariff plan service in database
    const newService = await prisma.tariffPlanService.create({
      data: {
        service_id,
        service_name,
        category_id: category_id, // Store the category ID (CON, LAB, etc.)
        category_name: getCategoryName(category_id),
        price: servicePrice, // Use converted price in NGN
        original_currency: originalCurrency,
        original_price: originalPrice,
        exchange_rate_used: exchangeRateUsed,
        exchange_rate_date: exchangeRateDate,
        is_primary: Boolean(is_primary),
        is_secondary: Boolean(is_secondary),
        provider_id: provider_id,
        tariff_plan_id: tariffPlan.id,
        is_draft: true, // New services are drafts until submitted
        status: 'ACTIVE'
      }
    })

    // Create link in junction table
    await prisma.tariffPlanServiceLink.create({
      data: {
        tariff_plan_id: tariffPlan.id,
        service_id: newService.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "TARIFF_PLAN_SERVICE_CREATE",
        resource: "tariff_plan_service",
        resource_id: newService.id,
        new_values: newService,
      },
    })

    return NextResponse.json({
      success: true,
      service: newService
    })

  } catch (error) {
    console.error("Error creating tariff plan service:", error)
    return NextResponse.json(
      { error: "Failed to create tariff plan service" },
      { status: 500 }
    )
  }
}

function getCategoryName(categoryId: string): string {
  const categories: Record<string, string> = {
    'CON': 'Consultation',
    'LAB': 'Laboratory Services',
    'RAD': 'Radiology / Imaging',
    'DRG': 'Drugs / Pharmaceuticals',
    'PRC': 'Procedures / Surgeries',
    'DEN': 'Dental Services',
    'EYE': 'Eye Care / Optometry',
    'PHY': 'Physiotherapy',
    'MAT': 'Maternity / Obstetrics',
    'PED': 'Paediatrics',
    'EMG': 'Emergency Services',
    'ADM': 'Admission / Inpatient',
    'CNS': 'Consumables / Supplies',
    'OTH': 'Others / Special Services'
  }
  return categories[categoryId] || categoryId
}
