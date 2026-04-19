import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getCategoryLimitAvailability, withCategoryLimitMetrics } from "@/lib/call-centre/category-limit-metrics"
import { LimitType } from "@prisma/client"
import fs from "fs/promises"
import path from "path"

async function getCategoryMapping(): Promise<Map<string, string>> {
  try {
    const categoriesPath = path.join(process.cwd(), "public", "plan_categories.json")
    const categoriesData = await fs.readFile(categoriesPath, "utf-8")
    const categories = JSON.parse(categoriesData) as Array<{ id: string; name: string }>
    return new Map(categories.map((category) => [category.name.toLowerCase(), category.id]))
  } catch (error) {
    console.error("[validate-coverage] Failed to load category mapping:", error)
    return new Map()
  }
}

type BasicServiceType = {
  id: string
  service_id: string
  service_name: string
  service_category: string
}

const SERVICE_NAME_ALIASES: Record<string, string[]> = {
  "rbs": ["random blood sugar rbs", "blood sugar fbs rbs"],
  "full blood count": ["full blood count fbc all parameters"],
  "ct. scan": ["ct scan"],
}

function normalizeServiceName(value?: string | null): string {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function getServiceGroup(category?: string | null, name?: string | null): string {
  const combined = `${category || ""} ${name || ""}`.toLowerCase()

  if (
    combined.includes("drug") ||
    combined.includes("pharmacy") ||
    combined.includes("medication") ||
    combined.includes("tablet") ||
    combined.includes("capsule") ||
    combined.includes("syrup") ||
    combined.includes("injection")
  ) {
    return "drug"
  }

  if (
    combined.includes("lab") ||
    combined.includes("blood") ||
    combined.includes("culture") ||
    combined.includes("urine") ||
    combined.includes("microscopy") ||
    combined.includes("haemat") ||
    combined.includes("chemistry")
  ) {
    return "lab"
  }

  if (
    combined.includes("x ray") ||
    combined.includes("scan") ||
    combined.includes("ct") ||
    combined.includes("mri") ||
    combined.includes("ultra") ||
    combined.includes("radiology") ||
    combined.includes("imaging")
  ) {
    return "radiology"
  }

  if (combined.includes("consult")) {
    return "consultation"
  }

  return "other"
}

function buildExactNameMap(serviceTypes: BasicServiceType[]) {
  const exactMap = new Map<string, BasicServiceType[]>()

  for (const serviceType of serviceTypes) {
    const normalized = normalizeServiceName(serviceType.service_name)
    if (!normalized) continue
    const existing = exactMap.get(normalized) || []
    existing.push(serviceType)
    exactMap.set(normalized, existing)
  }

  return exactMap
}

function resolveServiceTypeByName(
  providerService: { service_name: string; category_name?: string | null },
  serviceTypes: BasicServiceType[],
  exactNameMap: Map<string, BasicServiceType[]>
): BasicServiceType | null {
  const normalizedName = normalizeServiceName(providerService.service_name)
  if (!normalizedName) return null

  const serviceGroup = getServiceGroup(providerService.category_name, providerService.service_name)

  const sameGroup = (serviceType: BasicServiceType) =>
    getServiceGroup(serviceType.service_category, serviceType.service_name) === serviceGroup

  const exactCandidates = (exactNameMap.get(normalizedName) || []).filter(sameGroup)
  if (exactCandidates.length === 1) {
    return exactCandidates[0]
  }

  const aliasCandidates = (SERVICE_NAME_ALIASES[normalizedName] || [])
    .flatMap((alias) => exactNameMap.get(normalizeServiceName(alias)) || [])
    .filter(sameGroup)

  if (aliasCandidates.length === 1) {
    return aliasCandidates[0]
  }

  const containsCandidates = serviceTypes.filter((serviceType) => {
    if (!sameGroup(serviceType)) return false
    const normalizedServiceTypeName = normalizeServiceName(serviceType.service_name)
    return (
      normalizedServiceTypeName.includes(normalizedName) ||
      normalizedName.includes(normalizedServiceTypeName)
    )
  })

  if (containsCandidates.length === 1) {
    return containsCandidates[0]
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    // Safety check for Prisma client
    if (!prisma) {
      console.error('[validate-coverage] Prisma client is undefined!')
      return NextResponse.json(
        { error: "Database connection unavailable" },
        { status: 503 }
      )
    }

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { enrollee_id, provider_id, service_ids } = body

    if (!enrollee_id || !provider_id || !service_ids || !Array.isArray(service_ids)) {
      return NextResponse.json(
        { error: "Missing required fields: enrollee_id, provider_id, service_ids" },
        { status: 400 }
      )
    }

    // Get enrollee's plan - check if it's a principal or dependent
    let enrollee = await prisma.principalAccount.findUnique({
      where: { id: enrollee_id },
      select: {
        plan_id: true,
        plan: {
          select: {
            id: true,
            name: true,
            status: true,
            assigned_bands: true,
            band_type: true
          }
        }
      }
    })

    // If not found as principal, check if it's a dependent
    if (!enrollee) {
      const dependent = await prisma.dependent.findUnique({
        where: { id: enrollee_id },
        select: {
          principal_id: true,
          principal: {
            select: {
              plan_id: true,
              plan: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                  assigned_bands: true,
                  band_type: true
                }
              }
            }
          }
        }
      })

      if (dependent?.principal) {
        // Dependent inherits the plan from their principal
        enrollee = {
          plan_id: dependent.principal.plan_id,
          plan: dependent.principal.plan
        }
      }
    }

    if (!enrollee || !enrollee.plan_id) {
      return NextResponse.json(
        { error: "Enrollee not found or not assigned to a plan" },
        { status: 404 }
      )
    }

    if (enrollee.plan?.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: "Enrollee's plan is not active" },
        { status: 400 }
      )
    }

    const plan_id = enrollee.plan_id

    // Get provider's services
    const providerServices = await prisma.tariffPlanService.findMany({
      where: {
        provider_id: provider_id,
        OR: [
          { id: { in: service_ids } },
          { service_id: { in: service_ids } }
        ],
        is_draft: false,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        service_id: true,
        service_name: true,
        price: true,
        category_name: true
      }
    })

    // --- BANDING VALIDATION START ---

    // Helper function to get accessible bands based on hierarchical access
    const getAccessibleBands = (enrolleeBand: string): string[] => {
      const band = enrolleeBand.toLowerCase().trim()

      switch (band) {
        case 'band a':
        case 'a':
          return ['Band A', 'Band B', 'Band C'] // A has access to A, B, C
        case 'band b':
        case 'b':
          return ['Band B', 'Band C'] // B has access to B, C only
        case 'band c':
        case 'c':
          return ['Band C'] // C has access to C only
        default:
          return [enrolleeBand] // Default to same band
      }
    }

    // Helper function to normalize band names
    const normalizeBand = (band: string): string => {
      const normalized = band.toLowerCase().trim()
      if (normalized === 'a' || normalized === 'band a') return 'Band A'
      if (normalized === 'b' || normalized === 'band b') return 'Band B'
      if (normalized === 'c' || normalized === 'band c') return 'Band C'
      return band
    }

    const enrolleePlan = enrollee.plan
    const enrolleeBands = enrolleePlan.assigned_bands && enrolleePlan.assigned_bands.length > 0
      ? enrolleePlan.assigned_bands
      : (enrolleePlan.band_type ? [enrolleePlan.band_type] : [])

    // Log band information for debugging
    console.log('[Band Validation] Enrollee Bands:', enrolleeBands)
    console.log('[Band Validation] Plan:', { plan_id, plan_name: enrollee.plan.name })

    // Check PlanBand configuration
    const planBands = await prisma.planBand.findMany({
      where: {
        plan_id: plan_id,
        provider_id: provider_id,
        status: 'ACTIVE'
      }
    })

    let providerBands: string[] = []

    if (planBands.length > 0) {
      providerBands = planBands.map(pb => pb.band_type)
    } else {
      // Fallback to Provider selected bands if no explicit PlanBand config
      const provider = await prisma.provider.findUnique({
        where: { id: provider_id },
        select: { selected_bands: true }
      })
      providerBands = provider?.selected_bands || []
    }

    // Log provider bands for debugging
    console.log('[Band Validation] ===== START VALIDATION =====')
    console.log('[Band Validation] Enrollee ID:', enrollee_id)
    console.log('[Band Validation] Provider ID:', provider_id)
    console.log('[Band Validation] Provider Bands:', providerBands)
    console.log('[Band Validation] Provider Bands Length:', providerBands.length)
    console.log('[Band Validation] Provider Bands Type:', typeof providerBands)
    
    // If provider has no bands, reject
    if (!providerBands || providerBands.length === 0) {
      console.log('[Band Validation] ❌ Provider has NO bands configured - REJECTING all services')
      const noBandResults = service_ids.map((sid: string) => {
        const svc = providerServices.find(ps => ps.service_id === sid)
        return {
          service_id: sid,
          service_name: svc?.service_name || 'Unknown',
          provider_price: svc?.price || 0,
          coverage: 'NOT_COVERED',
          reason: 'Provider has no band configuration',
          price_limit: null,
          frequency_limit: null
        }
      })

      return NextResponse.json({
        success: true,
        plan: {
          id: plan_id,
          name: enrollee.plan.name
        },
        coverage: noBandResults,
        summary: {
          total_services: service_ids.length,
          covered: 0,
          not_covered: service_ids.length,
          limit_exceeded: 0,
          all_covered: false
        }
      })
    }

    // If enrollee has no bands assigned, reject immediately
    if (enrolleeBands.length === 0) {
      const noBandResults = service_ids.map((sid: string) => {
        const svc = providerServices.find(ps => ps.service_id === sid)
        return {
          service_id: sid,
          service_name: svc?.service_name || 'Unknown',
          provider_price: svc?.price || 0,
          coverage: 'NOT_COVERED',
          reason: 'Enrollee has no band assignment',
          price_limit: null,
          frequency_limit: null
        }
      })

      return NextResponse.json({
        success: true,
        plan: {
          id: plan_id,
          name: enrollee.plan.name
        },
        coverage: noBandResults,
        summary: {
          total_services: service_ids.length,
          covered: 0,
          not_covered: service_ids.length,
          limit_exceeded: 0,
          all_covered: false
        }
      })
    }

    // Validate Band Access
    let isBandMatch = false

    // If no provider bands are configured, we might assume NO access, or permissive.
    // Assuming strict: if provider has no bands, it might not be categorized.
    // But let's check for match if bands exist.

    if (providerBands.length > 0) {
      console.log('[Band Validation] ----- Checking band access -----')
      console.log('[Band Validation] Enrollee Bands:', enrolleeBands)
      console.log('[Band Validation] Provider Bands:', providerBands)
      
      isBandMatch = enrolleeBands.some(enrolleeBand => {
        const accessibleBands = getAccessibleBands(enrolleeBand)
        console.log(`[Band Validation] Enrollee Band '${enrolleeBand}' can access:`, accessibleBands)
        
        const hasMatch = accessibleBands.some(accessibleBand => {
          const normalizedAccessible = normalizeBand(accessibleBand)
          console.log(`[Band Validation]   Checking if '${normalizedAccessible}' matches any provider band...`)
          
          const matchFound = providerBands.some(pBand => {
            const normalizedProvider = normalizeBand(pBand)
            console.log(`[Band Validation]     Comparing '${normalizedAccessible}' === '${normalizedProvider}'`)
            const matches = normalizedProvider === normalizedAccessible
            if (matches) {
              console.log(`[Band Validation]     ✓ MATCH FOUND: Enrollee can access '${normalizedAccessible}', Provider offers '${normalizedProvider}'`)
            } else {
              console.log(`[Band Validation]     ✗ No match: '${normalizedAccessible}' !== '${normalizedProvider}'`)
            }
            return matches
          })
          return matchFound
        })
        
        console.log(`[Band Validation]   Has match for enrollee band '${enrolleeBand}':`, hasMatch)
        return hasMatch
      })
      
      console.log('[Band Validation] ===== FINAL MATCH RESULT:', isBandMatch, '=====')

      // Band matching logic:
      // - Band A enrollees can access Band A, B, or C providers
      // - Band B enrollees can access Band B or C providers  
      // - Band C enrollees can ONLY access Band C providers
      // The isBandMatch check above handles this correctly by checking
      // if enrollee's accessible bands intersect with provider's bands
    } else {
      // Provider has no bands? 
      // If using PlanBand approach, maybe allow if empty? Or deny?
      // Let's assume deny if we are strictly enforcing banding.
      // But for safety, if providerBands is empty, maybe we skip check?
      // User said "Banding is not functioning".
      // Let's assume strict: isBandMatch = false (default)
      // Check if providerBands is empty:
      if (providerBands.length === 0) {
        // Maybe fallback to true to avoid blocking legacy providers? 
        // Or false?
        // Let's stick to positive match logic.
        isBandMatch = false
      }
    }

    if (!isBandMatch && providerBands.length > 0) {
      // Return NOT_COVERED for all services immediately
      const bandingResults = service_ids.map((sid: string) => { // service_ids from body
        // Find service details from providerServices lookup
        const svc = providerServices.find(ps => ps.service_id === sid)
        return {
          service_id: sid,
          service_name: svc?.service_name || 'Unknown',
          provider_price: svc?.price || 0,
          coverage: 'NOT_COVERED',
          reason: `Provider Band (${providerBands.join(', ')}) not accessible by Enrollee Band (${enrolleeBands.join(', ')})`,
          price_limit: null,
          frequency_limit: null
        }
      })

      return NextResponse.json({
        success: true,
        plan: {
          id: plan_id,
          name: enrollee.plan.name
        },
        coverage: bandingResults,
        summary: {
          total_services: service_ids.length,
          covered: 0,
          not_covered: service_ids.length,
          limit_exceeded: 0,
          all_covered: false
        }
      })
    }

    // --- BANDING VALIDATION END ---

    // Get service types for coverage checking
    const categoryMapping = await getCategoryMapping()
    const providerServiceIds = providerServices.map((service) => service.service_id)
    const serviceTypes = await prisma.serviceType.findMany({
      where: {
        OR: [
          { service_id: { in: providerServiceIds } },
          { id: { in: providerServiceIds } }
        ]
      },
      select: {
        id: true,
        service_id: true,
        service_name: true,
        service_category: true
      }
    })

    const allServiceTypes = await prisma.serviceType.findMany({
      select: {
        id: true,
        service_id: true,
        service_name: true,
        service_category: true
      }
    })

    const exactNameMap = buildExactNameMap(allServiceTypes)

    // Create map of provider service_id to service type
    const serviceTypeMap = new Map<string, typeof serviceTypes[number]>()
    for (const serviceType of serviceTypes) {
      // Support both current numeric/string service_id references and older rows
      // that stored the ServiceType primary key directly in tariff_plan_services.service_id.
      serviceTypeMap.set(serviceType.service_id, serviceType)
      serviceTypeMap.set(serviceType.id, serviceType)
    }

    const providerServicesWithMetrics = await withCategoryLimitMetrics(
      providerServices.map((service) => ({
        service_id: service.service_id,
        service_name: service.service_name,
        category_name: service.category_name,
        price: Number(service.price || 0),
      })),
      enrollee_id
    )
    const providerServiceMetricsMap = new Map(
      providerServicesWithMetrics.map((service) => [service.service_id, service])
    )

    // Check coverage for each service
    const coverageResults = await Promise.all(
      providerServices.map(async (service) => {
        const serviceType =
          serviceTypeMap.get(service.service_id) ||
          resolveServiceTypeByName(service, allServiceTypes, exactNameMap)
        const service_type_id = serviceType?.id

        const categoryId =
          (serviceType ? categoryMapping.get(serviceType.service_category.toLowerCase()) : null) ||
          (service.category_name ? categoryMapping.get(service.category_name.toLowerCase()) : null)

        if (!service_type_id && !categoryId) {
          return {
            service_id: service.service_id,
            service_name: service.service_name,
            provider_price: service.price,
            coverage: 'NOT_COVERED',
            reason: 'Service type not found in system and no category matched',
            price_limit: null,
            frequency_limit: null
          }
        }

        // Check if service is covered in the plan
        let coveredService = null;
        
        if (service_type_id) {
          coveredService = await prisma.coveredService.findFirst({
            where: {
              plan_id: plan_id,
              service_type_id: service_type_id,
              status: 'ACTIVE'
            },
            select: {
              id: true,
              facility_price: true,
              status: true
            }
          })
        }

        // Fallback: If no exact service_type match, check if the plan broadly covers the category
        if (!coveredService && categoryId) {
             const categoryCovered = await prisma.coveredService.findFirst({
                where: {
                    plan_id: plan_id,
                    status: 'ACTIVE',
                    service_type: {
                        service_category: {
                            contains: service.category_name || (serviceType ? serviceType.service_category : ""),
                            mode: 'insensitive'
                        }
                    }
                }
             });
             
             if (categoryCovered) {
                 coveredService = {
                     id: categoryCovered.id,
                     facility_price: categoryCovered.facility_price,
                     status: categoryCovered.status
                 };
             }
        }

        if (!coveredService) {
          return {
            service_id: service.service_id,
            service_name: service.service_name,
            provider_price: service.price,
            coverage: 'NOT_COVERED',
            reason: service_type_id ? 'Service not included in enrollee plan' : 'Service type not found in system',
            price_limit: null,
            frequency_limit: null
          }
        }

        const categoryMetrics = providerServiceMetricsMap.get(service.service_id)
        if (categoryMetrics) {
          const categoryAvailability = getCategoryLimitAvailability(categoryMetrics)
          if (categoryAvailability.isBlocked) {
            return {
              service_id: service.service_id,
              service_name: service.service_name,
              provider_price: service.price,
              coverage: "LIMIT_EXCEEDED",
              reason: categoryAvailability.reason,
              price_limit: categoryMetrics.category_price_limit ?? null,
              frequency_limit: categoryMetrics.category_frequency_limit ?? null
            }
          }
        }

        // Check price and frequency limits
        const serviceLimits = await prisma.planLimit.findMany({
          where: {
            plan_id: plan_id,
            OR: [
              {
                limit_type: { in: [LimitType.SERVICE_PRICE, LimitType.SERVICE_FREQUENCY] },
                service_id: service_type_id
              },
              ...(categoryId ? [{
                limit_type: { in: [LimitType.CATEGORY_PRICE, LimitType.CATEGORY_FREQUENCY] },
                category_id: categoryId,
                service_id: 'ALL'
              }] : [])
            ]
          },
          select: {
            limit_type: true,
            price_limit: true,
            frequency_limit: true
          }
        })

        let price_limit: number | null = null
        let frequency_limit: number | null = null

        for (const limit of serviceLimits) {
          if ((limit.limit_type === 'SERVICE_PRICE' || limit.limit_type === 'CATEGORY_PRICE') && limit.price_limit !== null) {
            price_limit = Number(limit.price_limit)
          }
          if ((limit.limit_type === 'SERVICE_FREQUENCY' || limit.limit_type === 'CATEGORY_FREQUENCY') && limit.frequency_limit !== null) {
            frequency_limit = limit.frequency_limit
          }
        }

        // Check if price exceeds limit
        if (price_limit && service.price > price_limit) {
          return {
            service_id: service.service_id,
            service_name: service.service_name,
            provider_price: service.price,
            coverage: 'LIMIT_EXCEEDED',
            reason: `Service price (₦${service.price.toLocaleString()}) exceeds plan limit (₦${price_limit.toLocaleString()})`,
            price_limit: price_limit,
            frequency_limit: frequency_limit
          }
        }

        // TODO: Check frequency limit (would require counting previous usage)
        // For now, just return the frequency limit value if it exists

        return {
          service_id: service.service_id,
          service_name: service.service_name,
          provider_price: service.price,
          coverage: 'COVERED',
          reason: null,
          price_limit: price_limit,
          frequency_limit: frequency_limit
        }
      })
    )

    // Summary
    const summary = {
      total_services: coverageResults.length,
      covered: coverageResults.filter(r => r.coverage === 'COVERED').length,
      not_covered: coverageResults.filter(r => r.coverage === 'NOT_COVERED').length,
      limit_exceeded: coverageResults.filter(r => r.coverage === 'LIMIT_EXCEEDED').length,
      all_covered: coverageResults.every(r => r.coverage === 'COVERED')
    }

    return NextResponse.json({
      success: true,
      plan: {
        id: plan_id,
        name: enrollee.plan.name
      },
      coverage: coverageResults,
      summary
    })

  } catch (error) {
    console.error("Error validating coverage:", error)
    return NextResponse.json(
      { error: "Failed to validate coverage" },
      { status: 500 }
    )
  }
}
