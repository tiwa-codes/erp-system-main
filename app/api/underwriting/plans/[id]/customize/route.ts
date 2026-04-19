import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"
import path from "path"
import fs from "fs/promises"

const customizationSchema = z.object({
  customizations: z.array(z.object({
    categoryId: z.string(),
    categoryName: z.string(),
    selectedServices: z.array(z.string()),
    priceLimit: z.number().optional().nullable(),
    frequencyLimit: z.number().optional().nullable(),
    serviceLimits: z.record(z.object({
      priceLimit: z.number().optional(),
      frequencyLimit: z.number().optional()
    })).optional()
  }))
})

const specialServiceTableSchema = z.object({
  columns: z.array(z.string().min(1)),
  categories: z.array(
    z.object({
      id: z.string(),
      title: z.string().min(1),
      rows: z.array(
        z.object({
          id: z.string(),
          serviceName: z.string().optional().default(""),
          values: z.record(z.string()).optional().default({}),
        })
      ),
    })
  ),
})

const specialServicePlanColumnSchema = z.object({
  id: z.string().optional().default(""),
  name: z.string().min(1).default(""),
  individualPrice: z.number().min(0).default(0),
  familyPrice: z.number().min(0).default(0),
  individualLimit: z.number().nullable().optional().default(null),
  familyLimit: z.number().nullable().optional().default(null),
  individualUnlimited: z.boolean().optional().default(false),
  familyUnlimited: z.boolean().optional().default(false),
  hospitalTiers: z.array(z.string()).optional().default([]),
})

const specialServiceConfigSchema = z.object({
  enabled: z.boolean().optional().default(true),
  accountTypes: z.array(z.enum(["INDIVIDUAL", "FAMILY", "CORPORATE"])).default([]),
  accountTypePrices: z.record(z.number().min(0)).default({}),
  unlimitedAnnualLimit: z.boolean().optional().default(false),
  totalAnnualLimit: z.number().nullable().optional(),
  regionOfCover: z.string().optional().default(""),
  hospitalTiers: z.array(z.string()).default([]),
  plans: z.array(specialServicePlanColumnSchema).default([]),
  table: specialServiceTableSchema,
})

function deriveAccountTypePricesFromPlanColumns(options: {
  accountTypes: string[]
  existingPrices?: Record<string, number>
  plans?: Array<{
    individualPrice?: number | null
    familyPrice?: number | null
  }>
}) {
  const existingPrices = options.existingPrices || {}
  const plans = Array.isArray(options.plans) ? options.plans : []

  const totals = {
    INDIVIDUAL: 0,
    FAMILY: 0,
  }

  for (const plan of plans) {
    totals.INDIVIDUAL += Number(plan?.individualPrice || 0)
    totals.FAMILY += Number(plan?.familyPrice || 0)
  }

  return options.accountTypes.reduce<Record<string, number>>((acc, type) => {
    if (type === "INDIVIDUAL") {
      acc[type] = Number.isFinite(totals.INDIVIDUAL) ? totals.INDIVIDUAL : 0
      return acc
    }
    if (type === "FAMILY") {
      acc[type] = Number.isFinite(totals.FAMILY) ? totals.FAMILY : 0
      return acc
    }

    const fallbackValue = Number(existingPrices[type] ?? 0)
    acc[type] = Number.isFinite(fallbackValue) ? fallbackValue : 0
    return acc
  }, {})
}

// Helper function to load plan categories and create a mapping
async function getCategoryMapping(): Promise<Map<string, string>> {
  try {
    const categoriesPath = path.join(process.cwd(), 'public', 'plan_categories.json')
    const categoriesData = await fs.readFile(categoriesPath, 'utf-8')
    const categories = JSON.parse(categoriesData) as Array<{ name: string; id: string }>

    const mapping = new Map<string, string>()
    categories.forEach(cat => {
      mapping.set(cat.name.toLowerCase(), cat.id)
    })
    return mapping
  } catch (error) {
    console.error('Error loading plan categories:', error)
    return new Map()
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function buildCoveredServiceGroupKey(priceLimit: number, frequencyLimit: number | null) {
  return `${priceLimit}::${frequencyLimit ?? "null"}`
}

async function canManageCustomization(role: string, planId: string, action: "view" | "edit") {
  if (await checkPermission(role as any, "underwriting", action)) {
    return true
  }

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: { approval_stage: true },
  })

  if (!plan) {
    return false
  }

  if (plan.approval_stage === "SPECIAL_RISK") {
    return checkPermission(role as any, "special-risk", action)
  }

  if (plan.approval_stage === "MD") {
    return checkPermission(role as any, "executive-desk", action)
  }

  return false
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has underwriting permissions
    const hasPermission = await canManageCustomization(session.user.role as string, params.id, "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()

    // Verify plan exists
    const plan = await prisma.plan.findUnique({
      where: { id: params.id }
    })

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    const existingMetadata = (plan.metadata && typeof plan.metadata === "object")
      ? (plan.metadata as Record<string, any>)
      : {}
    const currentSpecialServiceConfig = existingMetadata.specialServiceConfig
    const isSpecialServicePlan = Boolean(currentSpecialServiceConfig?.enabled)

    if (isSpecialServicePlan || body?.specialServiceConfig) {
      const parsedConfig = specialServiceConfigSchema.parse(
        body?.specialServiceConfig || currentSpecialServiceConfig
      )

      const accountTypes = Array.from(new Set(parsedConfig.accountTypes))
      const derivedAccountTypePrices = deriveAccountTypePricesFromPlanColumns({
        accountTypes,
        existingPrices: parsedConfig.accountTypePrices,
        plans: parsedConfig.plans,
      })
      const primaryPlanType = (accountTypes.includes("FAMILY")
        ? "FAMILY"
        : accountTypes.includes("INDIVIDUAL")
          ? "INDIVIDUAL"
          : accountTypes[0]) || plan.plan_type

      const primaryPrice = Number(
        derivedAccountTypePrices[primaryPlanType] ??
          derivedAccountTypePrices[plan.plan_type] ??
          parsedConfig.accountTypePrices[primaryPlanType] ??
          parsedConfig.accountTypePrices[plan.plan_type] ??
          plan.premium_amount
      )

      const normalizedPlans = parsedConfig.plans.map((planColumn) => ({
        ...planColumn,
        hospitalTiers: (planColumn.hospitalTiers || [])
          .map((tier) => tier.trim())
          .filter(Boolean),
      }))

      const perPlanTierUnion = Array.from(
        new Set(
          normalizedPlans.flatMap((planColumn) => planColumn.hospitalTiers)
        )
      )

      const normalizedHospitalTiers = (perPlanTierUnion.length > 0
        ? perPlanTierUnion
        : parsedConfig.hospitalTiers
      )
        .map((tier) => tier.trim())
        .filter(Boolean)

      const updatedSpecialConfig = {
        ...parsedConfig,
        accountTypes,
        accountTypePrices: derivedAccountTypePrices,
        hospitalTiers: normalizedHospitalTiers,
        plans: normalizedPlans,
        table: {
          ...parsedConfig.table,
          columns: parsedConfig.table.columns.map((column) => column.trim()).filter(Boolean),
        },
      }

      const updatedPlan = await prisma.plan.update({
        where: { id: params.id },
        data: {
          plan_type: primaryPlanType as any,
          premium_amount: Number.isFinite(primaryPrice) ? primaryPrice : Number(plan.premium_amount),
          annual_limit: updatedSpecialConfig.unlimitedAnnualLimit
            ? 0
            : Number(updatedSpecialConfig.totalAnnualLimit ?? plan.annual_limit),
          assigned_bands: normalizedHospitalTiers.length > 0 ? normalizedHospitalTiers : plan.assigned_bands,
          metadata: {
            ...existingMetadata,
            specialServiceConfig: updatedSpecialConfig,
          },
          updated_at: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        message: "Special service table saved successfully",
        data: updatedPlan,
      })
    }

    // Log standard customization payload for diagnostics
    console.log('Saving plan customization:', {
      planId: params.id,
      customizationsCount: body.customizations?.length || 0,
      customizations: body.customizations?.map((c: any) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        selectedServicesCount: c.selectedServices?.length || 0
      }))
    })

    const validatedData = customizationSchema.parse(body)

    // Get all providers for this plan (we'll need them for covered services)
    const providers = await prisma.provider.findMany({
      where: { status: 'ACTIVE' }
    })

    if (providers.length === 0) {
      return NextResponse.json({
        error: "No active providers found. Please add providers first."
      }, { status: 400 })
    }

    const providerIds = providers.map((provider) => provider.id)

    // Process each customization
    const results = []
    const errors: string[] = []

    console.log(`\n🔄 Processing ${validatedData.customizations.length} category customizations...`)

    for (const customization of validatedData.customizations) {
      try {
        console.log(`\n📦 Processing category: ${customization.categoryName} (ID: ${customization.categoryId})`)
        console.log(`   Selected services: ${customization.selectedServices.length}`)
        console.log(`   Price limit: ${customization.priceLimit || 'none'}`)

        // Create category-level limit if saving price limit
        if (customization.priceLimit !== undefined && customization.priceLimit !== null) {
          await prisma.planLimit.upsert({
            where: {
              plan_id_limit_type_category_id_service_id: {
                plan_id: params.id,
                limit_type: 'CATEGORY_PRICE',
                category_id: customization.categoryId,
                service_id: 'ALL' // Use 'ALL' or empty string for category-level
              }
            },
            update: {
              price_limit: parseFloat(customization.priceLimit.toString()),
              updated_at: new Date()
            },
            create: {
              plan_id: params.id,
              limit_type: 'CATEGORY_PRICE',
              category_id: customization.categoryId,
              service_id: 'ALL',
              price_limit: parseFloat(customization.priceLimit.toString())
            }
          })
        }

        // Create category-level limit if saving frequency limit
        if (customization.frequencyLimit !== undefined && customization.frequencyLimit !== null) {
          await prisma.planLimit.upsert({
            where: {
              plan_id_limit_type_category_id_service_id: {
                plan_id: params.id,
                limit_type: 'CATEGORY_FREQUENCY',
                category_id: customization.categoryId,
                service_id: 'ALL'
              }
            },
            update: {
              frequency_limit: parseInt(customization.frequencyLimit.toString()),
              updated_at: new Date()
            },
            create: {
              plan_id: params.id,
              limit_type: 'CATEGORY_FREQUENCY',
              category_id: customization.categoryId,
              service_id: 'ALL',
              frequency_limit: parseInt(customization.frequencyLimit.toString())
            }
          })
        }

        // Get service types for this category
        const serviceTypes = await prisma.serviceType.findMany({
          where: {
            service_category: {
              contains: customization.categoryName,
              mode: 'insensitive'
            }
          },
          select: {
            id: true,
            service_id: true
          }
        })

        console.log(`   Found ${serviceTypes.length} service types in database for category "${customization.categoryName}"`)

        const resolvedSelectedServices = customization.selectedServices
          .map((submittedId) => {
            const serviceType = serviceTypes.find(
              (entry) => entry.id === submittedId || entry.service_id === submittedId
            )

            if (!serviceType) {
              console.warn(`   ⚠️  Service type ${submittedId} not found in category "${customization.categoryName}"`)
              return null
            }

            return {
              submittedId,
              serviceTypeId: serviceType.id
            }
          })
          .filter((value): value is { submittedId: string; serviceTypeId: string } => value !== null)

        const uniqueSelectedServiceTypeIds = [...new Set(resolvedSelectedServices.map((entry) => entry.serviceTypeId))]

        const existingCoveredServices = uniqueSelectedServiceTypeIds.length > 0
          ? await prisma.coveredService.findMany({
              where: {
                plan_id: params.id,
                facility_id: { in: providerIds },
                service_type_id: { in: uniqueSelectedServiceTypeIds }
              },
              select: {
                facility_id: true,
                service_type_id: true
              }
            })
          : []

        const existingCoveredServiceMap = new Map<string, Set<string>>()
        for (const coveredService of existingCoveredServices) {
          if (!existingCoveredServiceMap.has(coveredService.service_type_id)) {
            existingCoveredServiceMap.set(coveredService.service_type_id, new Set())
          }
          existingCoveredServiceMap.get(coveredService.service_type_id)!.add(coveredService.facility_id)
        }

        // Create or update covered services for selected services in grouped batches.
        let createdCount = 0
        let updatedCount = 0
        const updateGroups = new Map<string, {
          serviceTypeIds: string[]
          priceLimit: number
          frequencyLimit: number | null
        }>()
        const createPayload: Array<{
          plan_id: string
          facility_id: string
          service_type_id: string
          facility_price: number
          limit_count: number | null
          status: 'ACTIVE'
        }> = []
        const serviceLevelLimitRows: Array<{
          plan_id: string
          limit_type: 'SERVICE_PRICE' | 'SERVICE_FREQUENCY'
          category_id: string
          service_id: string
          price_limit?: number
          frequency_limit?: number
        }> = []

        for (const resolvedService of resolvedSelectedServices) {
          const serviceLimit =
            customization.serviceLimits?.[resolvedService.submittedId] ||
            customization.serviceLimits?.[resolvedService.serviceTypeId] ||
            {}
          const servicePriceLimit = Number(serviceLimit.priceLimit ?? customization.priceLimit ?? 0)
          const serviceFrequencyLimit = (serviceLimit.frequencyLimit !== undefined && serviceLimit.frequencyLimit !== null)
            ? Number(serviceLimit.frequencyLimit)
            : (customization.frequencyLimit !== undefined && customization.frequencyLimit !== null)
              ? Number(customization.frequencyLimit)
              : null
          const normalizedFrequencyLimit = Number.isFinite(serviceFrequencyLimit as number)
            ? parseInt(String(serviceFrequencyLimit), 10)
            : null

          const groupKey = buildCoveredServiceGroupKey(servicePriceLimit, normalizedFrequencyLimit)
          if (!updateGroups.has(groupKey)) {
            updateGroups.set(groupKey, {
              serviceTypeIds: [],
              priceLimit: servicePriceLimit,
              frequencyLimit: normalizedFrequencyLimit
            })
          }
          updateGroups.get(groupKey)!.serviceTypeIds.push(resolvedService.serviceTypeId)

          const existingFacilityIds = existingCoveredServiceMap.get(resolvedService.serviceTypeId) || new Set<string>()
          for (const providerId of providerIds) {
            if (!existingFacilityIds.has(providerId)) {
              createPayload.push({
                plan_id: params.id,
                facility_id: providerId,
                service_type_id: resolvedService.serviceTypeId,
                facility_price: servicePriceLimit,
                limit_count: normalizedFrequencyLimit,
                status: 'ACTIVE'
              })
            }
          }

          if (serviceLimit.priceLimit !== undefined && serviceLimit.priceLimit !== null) {
            serviceLevelLimitRows.push({
              plan_id: params.id,
              limit_type: 'SERVICE_PRICE',
              category_id: customization.categoryId,
              service_id: resolvedService.serviceTypeId,
              price_limit: parseFloat(serviceLimit.priceLimit.toString())
            })
          }

          if (serviceLimit.frequencyLimit !== undefined && serviceLimit.frequencyLimit !== null) {
            serviceLevelLimitRows.push({
              plan_id: params.id,
              limit_type: 'SERVICE_FREQUENCY',
              category_id: customization.categoryId,
              service_id: resolvedService.serviceTypeId,
              frequency_limit: parseInt(serviceLimit.frequencyLimit.toString(), 10)
            })
          }
        }

        for (const group of updateGroups.values()) {
          const updateResult = await prisma.coveredService.updateMany({
            where: {
              plan_id: params.id,
              facility_id: { in: providerIds },
              service_type_id: { in: group.serviceTypeIds }
            },
            data: {
              facility_price: group.priceLimit,
              limit_count: group.frequencyLimit,
              status: 'ACTIVE',
              updated_at: new Date()
            }
          })
          updatedCount += updateResult.count
        }

        for (const payloadChunk of chunkArray(createPayload, 1000)) {
          await prisma.coveredService.createMany({
            data: payloadChunk
          })
        }
        createdCount = createPayload.length

        await prisma.planLimit.deleteMany({
          where: {
            plan_id: params.id,
            category_id: customization.categoryId,
            limit_type: { in: ['SERVICE_PRICE', 'SERVICE_FREQUENCY'] }
          }
        })

        for (const payloadChunk of chunkArray(serviceLevelLimitRows, 1000)) {
          await prisma.planLimit.createMany({
            data: payloadChunk
          })
        }

        console.log(`   ✅ Created ${createdCount} new covered services, updated ${updatedCount} existing`)

        // Remove covered services for unselected services
        const unselectedServices = serviceTypes
          .filter((serviceType) => !uniqueSelectedServiceTypeIds.includes(serviceType.id))
          .map(st => st.id)

        if (unselectedServices.length > 0) {
          const deactivated = await prisma.coveredService.updateMany({
            where: {
              plan_id: params.id,
              service_type_id: { in: unselectedServices }
            },
            data: {
              status: 'INACTIVE',
              updated_at: new Date()
            }
          })
          console.log(`   🔴 Deactivated ${deactivated.count} unselected services`)
        }

        results.push({
          categoryId: customization.categoryId,
          categoryName: customization.categoryName,
          selectedServices: customization.selectedServices.length,
          priceLimit: customization.priceLimit
        })

        console.log(`   ✅ Successfully saved ${customization.categoryName}`)
      } catch (error: any) {
        console.error(`   ❌ Error processing customization for ${customization.categoryName}:`, error)
        errors.push(`Failed to save ${customization.categoryName}: ${error.message}`)
      }
    }

    console.log(`\n📊 Save Summary:`)
    console.log(`   ✅ Successful: ${results.length} categories`)
    console.log(`   ❌ Failed: ${errors.length} categories`)
    if (results.length > 0) {
      console.log(`   Saved categories: ${results.map(r => r.categoryName).join(', ')}`)
    }
    if (errors.length > 0) {
      console.log(`   Errors: ${errors.join('; ')}`)
    }

    if (errors.length > 0 && results.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Failed to save customizations",
        details: errors
      }, { status: 500 })
    }

    if (errors.length > 0) {
      console.warn('Some customizations failed to save:', errors)
    }

    return NextResponse.json({
      success: true,
      message: "Plan customization saved successfully",
      results,
      savedCategories: results.map(r => r.categoryName)
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.errors)
      return NextResponse.json(
        {
          success: false,
          error: "Validation error",
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      )
    }

    console.error("Error saving plan customization:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save plan customization",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has underwriting permissions
    const hasPermission = await canManageCustomization(session.user.role as string, params.id, "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Get plan with its covered services
    const plan = await prisma.plan.findUnique({
      where: { id: params.id },
      include: {
        covered_services: {
          where: { status: 'ACTIVE' },
          include: {
            service_type: true,
            facility: {
              select: {
                id: true,
                facility_name: true
              }
            }
          }
        },
        plan_limits: {
          where: {
            limit_type: { in: ['SERVICE_PRICE', 'SERVICE_FREQUENCY', 'CATEGORY_PRICE', 'CATEGORY_FREQUENCY'] }
          }
        }
      }
    })

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    // Create a map of service limits from plan_limits
    const serviceLimitsMap = new Map<string, { priceLimit?: number, frequencyLimit?: number }>()
    for (const planLimit of plan.plan_limits) {
      if (!planLimit.service_id) continue

      if (!serviceLimitsMap.has(planLimit.service_id)) {
        serviceLimitsMap.set(planLimit.service_id, {})
      }

      const limits = serviceLimitsMap.get(planLimit.service_id)!
      if (planLimit.limit_type === 'SERVICE_PRICE' && planLimit.price_limit) {
        limits.priceLimit = parseFloat(planLimit.price_limit.toString())
      } else if (planLimit.limit_type === 'SERVICE_FREQUENCY' && planLimit.frequency_limit) {
        limits.frequencyLimit = planLimit.frequency_limit
      }
    }

    // Create a map of category limits
    const categoryPriceLimitsMap = new Map<string, number>()
    const categoryFrequencyLimitsMap = new Map<string, number>()
    for (const planLimit of plan.plan_limits) {
      if (planLimit.category_id && planLimit.service_id === 'ALL') {
        if (planLimit.limit_type === 'CATEGORY_PRICE' && planLimit.price_limit) {
          categoryPriceLimitsMap.set(planLimit.category_id, parseFloat(planLimit.price_limit.toString()))
        } else if (planLimit.limit_type === 'CATEGORY_FREQUENCY' && planLimit.frequency_limit) {
          categoryFrequencyLimitsMap.set(planLimit.category_id, planLimit.frequency_limit)
        }
      }
    }

    // Load category mapping to match category names to IDs
    const categoryMapping = await getCategoryMapping()
    console.log(`\n📂 Loading customizations for plan ${params.id}`)
    console.log(`   Category mapping loaded: ${categoryMapping.size} categories`)

    // Group covered services by category
    const customizations = new Map()

    for (const coveredService of plan.covered_services) {
      const categoryName = coveredService.service_type.service_category
      // Use the mapping from plan_categories.json to get the correct categoryId
      const categoryId = categoryMapping.get(categoryName.toLowerCase()) || categoryName.toUpperCase().replace(/\s+/g, '_')

      if (!customizations.has(categoryId)) {
        customizations.set(categoryId, {
          categoryId,
          categoryName,
          selectedServices: [],
          priceLimit: categoryPriceLimitsMap.get(categoryId), // Prefer explicitly saved category limit
          frequencyLimit: categoryFrequencyLimitsMap.get(categoryId),
          serviceLimits: {}
        })
      }

      // If priceLimit is still undefined in the map (e.g. from existing services), try to populate it
      // But we should prioritize the PlanLimit table.
      // If PlanLimit has it, it's in categoryLimitsMap.
      // If not, maybe fallback to facility_price? But that causes the bug.
      // Let's stick to PlanLimit. If PlanLimit is missing, priceLimit is undefined.
      // This solves the 'resets to zero' if we rely on PlanLimit.

      const customization = customizations.get(categoryId)
      if (!customization.selectedServices.includes(coveredService.service_type_id)) {
        customization.selectedServices.push(coveredService.service_type_id)
      }

      // Add service-level limits if they exist
      const serviceLimit = serviceLimitsMap.get(coveredService.service_type_id)
      if (serviceLimit) {
        customization.serviceLimits[coveredService.service_type_id] = serviceLimit
      }
    }

    // Also include categories that have plan limits but no covered services yet
    for (const planLimit of plan.plan_limits) {
      if (!planLimit.category_id || !planLimit.service_id) continue

      const categoryId = planLimit.category_id
      if (!customizations.has(categoryId)) {
        // Try to find category name from mapping
        let categoryName = categoryId
        for (const [name, id] of categoryMapping.entries()) {
          if (id === categoryId) {
            categoryName = name.charAt(0).toUpperCase() + name.slice(1)
            break
          }
        }

        customizations.set(categoryId, {
          categoryId,
          categoryName,
          selectedServices: [],
          priceLimit: categoryPriceLimitsMap.get(categoryId),
          frequencyLimit: categoryFrequencyLimitsMap.get(categoryId),
          serviceLimits: {}
        })
      }

      const customization = customizations.get(categoryId)
      if (planLimit.service_id !== 'ALL' && !customization.selectedServices.includes(planLimit.service_id)) {
        customization.selectedServices.push(planLimit.service_id)
      }

      // Add service-level limits
      if (planLimit.service_id !== 'ALL') {
        const serviceLimit = serviceLimitsMap.get(planLimit.service_id)
        if (serviceLimit) {
          customization.serviceLimits[planLimit.service_id] = serviceLimit
        }
      }
    }

    const customizationsArray = Array.from(customizations.values())
    console.log(`   Found ${customizationsArray.length} customized categories:`)
    customizationsArray.forEach(c => {
      console.log(`     - ${c.categoryName} (${c.categoryId}): ${c.selectedServices.length} services`)
    })

    const planMetadata = (plan.metadata && typeof plan.metadata === "object")
      ? (plan.metadata as Record<string, any>)
      : {}
    const specialServiceConfig = planMetadata.specialServiceConfig || null

    return NextResponse.json({
      success: true,
      customizations: customizationsArray,
      specialServiceConfig
    })

  } catch (error) {
    console.error("Error fetching plan customization:", error)
    return NextResponse.json(
      { error: "Failed to fetch plan customization" },
      { status: 500 }
    )
  }
}
