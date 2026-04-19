import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const customizationSchema = z.object({
  customizations: z.array(z.object({
    categoryId: z.string(),
    categoryName: z.string(),
    selectedServices: z.array(z.string()),
    priceLimit: z.number().optional(),
    serviceLimits: z.record(z.object({
      priceLimit: z.number().optional(),
      frequencyLimit: z.number().optional()
    })).optional()
  }))
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has settings permissions
    const hasPermission = await checkPermission(session.user.role as any, "settings", "edit")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = customizationSchema.parse(body)

    // Verify plan exists
    const plan = await prisma.plan.findUnique({
      where: { id: params.id }
    })

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    // Get all providers for this plan (we'll need them for covered services)
    const providers = await prisma.provider.findMany({
      where: { status: 'ACTIVE' }
    })

    if (providers.length === 0) {
      return NextResponse.json({ 
        error: "No active providers found. Please add providers first." 
      }, { status: 400 })
    }

    // Process each customization
    const results = []
    
    for (const customization of validatedData.customizations) {
      // Get service types for this category
      const serviceTypes = await prisma.serviceType.findMany({
        where: {
          service_category: {
            contains: customization.categoryName,
            mode: 'insensitive'
          }
        }
      })

      // Create or update covered services for selected services
      for (const serviceTypeId of customization.selectedServices) {
        const serviceType = serviceTypes.find(st => st.id === serviceTypeId)
        if (!serviceType) continue

        // Get service-level limits if available
        const serviceLimit = customization.serviceLimits?.[serviceTypeId] || {}
        const servicePriceLimit = serviceLimit.priceLimit || customization.priceLimit || 0

        // Create covered services for each provider
        for (const provider of providers) {
          // Check if covered service already exists
          const existingCoveredService = await prisma.coveredService.findFirst({
            where: {
              plan_id: params.id,
              facility_id: provider.id,
              service_type_id: serviceTypeId
            }
          })

          if (existingCoveredService) {
            // Update existing covered service
            await prisma.coveredService.update({
              where: { id: existingCoveredService.id },
              data: {
                facility_price: servicePriceLimit,
                limit_count: serviceLimit.frequencyLimit || null,
                status: 'ACTIVE',
                updated_at: new Date()
              }
            })
          } else {
            // Create new covered service
            await prisma.coveredService.create({
              data: {
                plan_id: params.id,
                facility_id: provider.id,
                service_type_id: serviceTypeId,
                facility_price: servicePriceLimit,
                limit_count: serviceLimit.frequencyLimit || null,
                status: 'ACTIVE'
              }
            })
          }
        }

        // Save service-level limits in PlanLimit model
        // Save price limit if provided
        if (serviceLimit.priceLimit) {
          await prisma.planLimit.upsert({
            where: {
              plan_id_limit_type_category_id_service_id: {
                plan_id: params.id,
                limit_type: 'SERVICE_PRICE',
                category_id: customization.categoryId,
                service_id: serviceTypeId
              }
            },
            update: {
              price_limit: parseFloat(serviceLimit.priceLimit.toString()),
              updated_at: new Date()
            },
            create: {
              plan_id: params.id,
              limit_type: 'SERVICE_PRICE',
              category_id: customization.categoryId,
              service_id: serviceTypeId,
              price_limit: parseFloat(serviceLimit.priceLimit.toString())
            }
          })
        }
        
        // Save frequency limit if provided
        if (serviceLimit.frequencyLimit) {
          await prisma.planLimit.upsert({
            where: {
              plan_id_limit_type_category_id_service_id: {
                plan_id: params.id,
                limit_type: 'SERVICE_FREQUENCY',
                category_id: customization.categoryId,
                service_id: serviceTypeId
              }
            },
            update: {
              frequency_limit: serviceLimit.frequencyLimit,
              updated_at: new Date()
            },
            create: {
              plan_id: params.id,
              limit_type: 'SERVICE_FREQUENCY',
              category_id: customization.categoryId,
              service_id: serviceTypeId,
              frequency_limit: serviceLimit.frequencyLimit
            }
          })
        }
      }

      // Remove covered services for unselected services
      const unselectedServices = serviceTypes
        .filter(st => !customization.selectedServices.includes(st.id))
        .map(st => st.id)

      if (unselectedServices.length > 0) {
        await prisma.coveredService.updateMany({
          where: {
            plan_id: params.id,
            service_type_id: { in: unselectedServices }
          },
          data: {
            status: 'INACTIVE',
            updated_at: new Date()
          }
        })
      }

      results.push({
        categoryId: customization.categoryId,
        categoryName: customization.categoryName,
        selectedServices: customization.selectedServices.length,
        priceLimit: customization.priceLimit
      })
    }

    return NextResponse.json({
      success: true,
      message: "Plan customization saved successfully",
      results
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error saving plan customization:", error)
    return NextResponse.json(
      { error: "Failed to save plan customization" },
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

    // Check if user has settings permissions
    const hasPermission = await checkPermission(session.user.role as any, "settings", "view")
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
            limit_type: { in: ['SERVICE_PRICE', 'SERVICE_FREQUENCY'] }
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

    // Group covered services by category
    const customizations = new Map()

    for (const coveredService of plan.covered_services) {
      const categoryName = coveredService.service_type.service_category
      const categoryId = categoryName.toUpperCase().replace(/\s+/g, '_')

      if (!customizations.has(categoryId)) {
        customizations.set(categoryId, {
          categoryId,
          categoryName,
          selectedServices: [],
          priceLimit: coveredService.facility_price,
          serviceLimits: {}
        })
      }

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

    return NextResponse.json({
      success: true,
      customizations: Array.from(customizations.values())
    })

  } catch (error) {
    console.error("Error fetching plan customization:", error)
    return NextResponse.json(
      { error: "Failed to fetch plan customization" },
      { status: 500 }
    )
  }
}
