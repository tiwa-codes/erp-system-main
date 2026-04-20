"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {

export const dynamic = 'force-dynamic'
  ArrowLeft,
  Search,
  Settings,
  Send,
  Save,
  Plus,
  DollarSign,
  CheckCircle
} from "lucide-react"

interface Plan {
  id: string
  name: string
  description?: string
  plan_type: "INDIVIDUAL" | "FAMILY" | "CORPORATE"
  premium_amount: number
  annual_limit: number
  band_type?: string
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED"
  metadata?: Record<string, any>
}

interface PlanCategory {
  name: string
  id: string
}

interface ServiceType {
  id: string
  service_id: string
  service_name: string
  service_category: string
  service_type?: string
}

interface CoveredService {
  id: string
  plan_id: string
  facility_id: string
  service_type_id: string
  facility_price: number
  limit_count?: number
  status: "ACTIVE" | "INACTIVE"
  service_type: ServiceType
  facility: {
    id: string
    facility_name: string
    practice: string
    status: string
  }
}

interface ServiceLimit {
  priceLimit?: number
  frequencyLimit?: number
}

interface PlanCustomization {
  categoryId: string
  categoryName: string
  services: ServiceType[]
  selectedServices: string[]
  priceLimit?: number // Category-level price limit
  frequencyLimit?: number // Category-level frequency limit
  serviceLimits: Record<string, ServiceLimit> // Service-level limits (price + frequency)
}

interface SpecialServiceRow {
  id: string
  serviceName: string
  values: Record<string, string>
}

interface SpecialServiceCategory {
  id: string
  title: string
  rows: SpecialServiceRow[]
}

interface SpecialServicePlanColumn {
  id: string
  name: string
  individualPrice: number
  familyPrice: number
  individualLimit: number | null
  familyLimit: number | null
  individualUnlimited: boolean
  familyUnlimited: boolean
  hospitalTiers: string[]
}

interface SpecialServiceConfig {
  enabled: boolean
  accountTypes: Array<"INDIVIDUAL" | "FAMILY" | "CORPORATE">
  accountTypePrices: Record<string, number>
  unlimitedAnnualLimit: boolean
  totalAnnualLimit: number | null
  regionOfCover: string
  hospitalTiers: string[]
  plans: SpecialServicePlanColumn[]
  table: {
    columns: string[]
    categories: SpecialServiceCategory[]
  }
}

const toStringArray = (input: any): string[] => {
  if (Array.isArray(input)) {
    return input
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

export default function PlanCustomizationPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const planId = params.id as string
  const returnTo = searchParams.get("returnTo") || "/underwriting/plans"
  const stageLabel = searchParams.get("stageLabel") || "Underwriting"
  const forceSpecialModeFromCustomPlans = returnTo.includes("/underwriting/custom-plans")

  const [searchTerm, setSearchTerm] = useState("")
  const [customizations, setCustomizations] = useState<PlanCustomization[]>([])
  const [planCategories, setPlanCategories] = useState<PlanCategory[]>([])
  const [loadingCategories, setLoadingCategories] = useState<Set<string>>(new Set())
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true)
  const [hasInitializedCustomizations, setHasInitializedCustomizations] = useState(false)
  const [isSpecialServiceMode, setIsSpecialServiceMode] = useState(false)
  const [specialConfig, setSpecialConfig] = useState<SpecialServiceConfig | null>(null)
  const [newTierColumn, setNewTierColumn] = useState("")
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [manualSaving, setManualSaving] = useState(false)
  const [editablePlanName, setEditablePlanName] = useState("")
  const [savingPlanName, setSavingPlanName] = useState(false)
  const specialConfigInitializedRef = useRef(false)
  const lastSavedSpecialSnapshotRef = useRef("")

  // Fetch plan details
  const { data: planData, isLoading: planLoading } = useQuery({
    queryKey: ["plan", planId],
    queryFn: async () => {
      const res = await fetch(`/api/underwriting/plans/${planId}`)
      if (!res.ok) throw new Error("Failed to fetch plan")
      return res.json()
    }
  })

  // Fetch plan categories from JSON file
  useEffect(() => {
    const fetchPlanCategories = async () => {
      try {
        setIsCategoriesLoading(true)
        const response = await fetch('/plan_categories.json')
        const categories: PlanCategory[] = await response.json()
        setPlanCategories(categories)
      } catch (error) {
        console.error('Error fetching plan categories:', error)
      } finally {
        setIsCategoriesLoading(false)
      }
    }

    fetchPlanCategories()
  }, [])

  // Fetch service types for a specific category - load ALL services from GlobalService
  const fetchServicesForCategory = async (categoryId: string) => {
    try {
      // Get category name from planCategories
      const category = planCategories.find(c => c.id === categoryId)
      const categoryName = category?.name || categoryId

      console.log('Fetching services for category:', { categoryId, categoryName })

      // Fetch from GlobalService API instead of Settings → Service Types
      const res = await fetch(`/api/underwriting/plans/global-services`)

      if (!res.ok) {
        const errorText = await res.text()
        console.error('API error response:', errorText)
        throw new Error(`Failed to fetch services: ${res.status} ${res.statusText}`)
      }

      const data = await res.json()
      const allServices = data.services || []

      // Filter services by category name (API returns service_category field)
      const services = allServices.filter((s: any) => s.service_category === categoryName)

      // Transform to match expected format
      const transformedServices = services.map((s: any) => ({
        id: s.id,
        service_id: s.id,
        service_name: s.service_name,
        service_category: s.service_category,
        service_type: s.service_type
      }))

      console.log(`Loaded ${transformedServices.length} services for category ${categoryName}`)

      if (transformedServices.length === 0) {
        console.warn(`No services found for category: ${categoryName} (ID: ${categoryId})`)
      }

      return transformedServices
    } catch (error) {
      console.error('Error fetching services for category:', error)
      throw error
    }
  }

  // Fetch existing customization data (includes service limits)
  const { data: customizationData, isLoading: isCustomizationLoading } = useQuery({
    queryKey: ["plan-customization", planId],
    queryFn: async () => {
      const res = await fetch(`/api/underwriting/plans/${planId}/customize`)
      if (!res.ok) throw new Error("Failed to fetch customization")
      return res.json()
    },
    enabled: !!planId
  })

  useEffect(() => {
    const incomingSpecialConfig = customizationData?.specialServiceConfig
    if (incomingSpecialConfig?.enabled) {
      const normalizedHospitalTiers = toStringArray(incomingSpecialConfig.hospitalTiers)
      const normalizedColumns = toStringArray(incomingSpecialConfig.table?.columns || normalizedHospitalTiers)
      const normalizedAccountTypes = toStringArray(incomingSpecialConfig.accountTypes).filter((type) =>
        ["INDIVIDUAL", "FAMILY", "CORPORATE"].includes(type)
      ) as Array<"INDIVIDUAL" | "FAMILY" | "CORPORATE">
      const normalizedCategories = Array.isArray(incomingSpecialConfig.table?.categories)
        ? incomingSpecialConfig.table.categories.map((category: any) => ({
            id: String(category?.id || `cat-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
            title: String(category?.title || "Category"),
            rows: Array.isArray(category?.rows)
              ? category.rows.map((row: any) => ({
                  id: String(row?.id || `row-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
                  serviceName: String(row?.serviceName || ""),
                  values:
                    row?.values && typeof row.values === "object"
                      ? Object.fromEntries(
                          Object.entries(row.values).map(([key, value]) => [String(key), String(value ?? "")])
                        )
                      : {},
                }))
              : [],
          }))
        : []

      const normalizedConfig: SpecialServiceConfig = {
        enabled: true,
        accountTypes: normalizedAccountTypes,
        accountTypePrices: incomingSpecialConfig.accountTypePrices || {},
        unlimitedAnnualLimit: Boolean(incomingSpecialConfig.unlimitedAnnualLimit),
        totalAnnualLimit:
          incomingSpecialConfig.totalAnnualLimit === null || incomingSpecialConfig.totalAnnualLimit === undefined
            ? null
            : Number(incomingSpecialConfig.totalAnnualLimit),
        regionOfCover: incomingSpecialConfig.regionOfCover || "",
        hospitalTiers: normalizedHospitalTiers,
        plans: Array.isArray(incomingSpecialConfig.plans)
          ? incomingSpecialConfig.plans.map((planColumn: any, index: number) => ({
              id: String(planColumn?.id || `plan-${Date.now()}-${index}`),
              name: String(planColumn?.name || normalizedColumns[index] || `Plan ${index + 1}`),
              individualPrice: Number(planColumn?.individualPrice || 0),
              familyPrice: Number(planColumn?.familyPrice || 0),
              individualLimit:
                planColumn?.individualLimit === null || planColumn?.individualLimit === undefined
                  ? null
                  : Number(planColumn.individualLimit),
              familyLimit:
                planColumn?.familyLimit === null || planColumn?.familyLimit === undefined
                  ? null
                  : Number(planColumn.familyLimit),
              individualUnlimited: Boolean(planColumn?.individualUnlimited),
              familyUnlimited: Boolean(planColumn?.familyUnlimited),
              hospitalTiers: toStringArray(planColumn?.hospitalTiers || normalizedHospitalTiers),
            }))
          : normalizedColumns.map((column: string, index: number) => ({
              id: `plan-${Date.now()}-${index}`,
              name: column,
              individualPrice: 0,
              familyPrice: 0,
              individualLimit: null,
              familyLimit: null,
              individualUnlimited: false,
              familyUnlimited: false,
              hospitalTiers: normalizedHospitalTiers,
            })),
        table: {
          columns: normalizedColumns,
          categories: normalizedCategories,
        },
      }
      setIsSpecialServiceMode(true)
      setSpecialConfig(normalizedConfig)
      lastSavedSpecialSnapshotRef.current = JSON.stringify(normalizedConfig)
      specialConfigInitializedRef.current = true
      return
    }

    if (forceSpecialModeFromCustomPlans) {
      const defaultAccountTypes: Array<"INDIVIDUAL" | "FAMILY" | "CORPORATE"> = ["INDIVIDUAL", "FAMILY"]
      const fallbackConfig: SpecialServiceConfig = {
        enabled: true,
        accountTypes: defaultAccountTypes,
        accountTypePrices: {},
        unlimitedAnnualLimit: false,
        totalAnnualLimit: Number(planData?.plan?.annual_limit || 0),
        regionOfCover: "",
        hospitalTiers: Array.isArray(planData?.plan?.assigned_bands) ? planData.plan.assigned_bands : [],
        plans: [
          {
            id: `plan-${Date.now()}-1`,
            name: "Plan 1",
            individualPrice: 0,
            familyPrice: 0,
            individualLimit: null,
            familyLimit: null,
            individualUnlimited: false,
            familyUnlimited: false,
            hospitalTiers: Array.isArray(planData?.plan?.assigned_bands) ? planData.plan.assigned_bands : [],
          },
        ],
        table: {
          columns: ["Plan 1"],
          categories: [],
        },
      }

      setIsSpecialServiceMode(true)
      setSpecialConfig(fallbackConfig)
      specialConfigInitializedRef.current = true
      return
    }

    setIsSpecialServiceMode(false)
    setSpecialConfig(null)
    specialConfigInitializedRef.current = false
    lastSavedSpecialSnapshotRef.current = ""
  }, [customizationData, forceSpecialModeFromCustomPlans, planData?.plan?.annual_limit, planData?.plan?.assigned_bands])

  // Fetch existing covered services for this plan
  const shouldLoadCoveredServicesFallback =
    Boolean(planId) &&
    !isSpecialServiceMode &&
    !(customizationData?.customizations?.length > 0)

  const { data: coveredServicesData, isLoading: isCoveredServicesLoading } = useQuery({
    queryKey: ["covered-services", planId],
    queryFn: async () => {
      const res = await fetch(`/api/settings/covered-services?plan_id=${planId}`)
      if (!res.ok) throw new Error("Failed to fetch covered services")
      return res.json()
    },
    enabled: shouldLoadCoveredServicesFallback
  })

  // Get existing covered services
  const existingCoveredServices = coveredServicesData?.covered_services || []

  const formatCurrencySafe = (value: any) => {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) return "N/A"
    return `₦${numericValue.toLocaleString()}`
  }

  useEffect(() => {
    if (planData?.plan?.name) {
      setEditablePlanName(planData.plan.name)
    }
  }, [planData?.plan?.name])

  const persistPlanName = async () => {
    const nextName = editablePlanName.trim()
    if (!nextName || !plan?.id || nextName === plan.name) return

    setSavingPlanName(true)
    try {
      const response = await fetch(`/api/underwriting/plans/${plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update plan name")
      }
      queryClient.invalidateQueries({ queryKey: ["plan", plan.id] })
      queryClient.invalidateQueries({ queryKey: ["underwriting-custom-plans"] })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to update plan name",
        variant: "destructive",
      })
      setEditablePlanName(plan.name)
    } finally {
      setSavingPlanName(false)
    }
  }

  // Auto-load existing customization when data is available
  useEffect(() => {
    if (isSpecialServiceMode || isCategoriesLoading || isCustomizationLoading || isCoveredServicesLoading || planCategories.length === 0 || hasInitializedCustomizations) {
      return
    }

    const servicesByCategory = new Map<string, string[]>()

    existingCoveredServices.forEach((cs: CoveredService) => {
      const categoryName = cs.service_type.service_category
      const category = planCategories.find(c => c.name === categoryName)
      if (!category) return

      if (!servicesByCategory.has(category.id)) {
        servicesByCategory.set(category.id, [])
      }
      servicesByCategory.get(category.id)!.push(cs.service_type_id)
    })

    const initialCustomizations = planCategories.map(category => {
      const existingCustom = customizationData?.customizations?.find(
        (c: any) => c.categoryId === category.id || c.categoryName === category.name
      )

      return {
        categoryId: category.id,
        categoryName: category.name,
        services: [],
        selectedServices: existingCustom?.selectedServices || servicesByCategory.get(category.id) || [],
        priceLimit: existingCustom?.priceLimit,
        frequencyLimit: existingCustom?.frequencyLimit,
        serviceLimits: existingCustom?.serviceLimits || {} as Record<string, ServiceLimit>
      }
    })

    setCustomizations(initialCustomizations)
    setHasInitializedCustomizations(true)
  }, [
    planCategories,
    customizationData,
    existingCoveredServices,
    hasInitializedCustomizations,
    isSpecialServiceMode,
    isCategoriesLoading,
    isCustomizationLoading,
    isCoveredServicesLoading
  ])

  useEffect(() => {
    if (isSpecialServiceMode || !hasInitializedCustomizations || planCategories.length === 0) {
      return
    }

    const categoriesToHydrate = customizations.filter((customization) =>
      customization.services.length === 0 &&
      (customization.selectedServices.length > 0 || Object.keys(customization.serviceLimits || {}).length > 0)
    )

    if (categoriesToHydrate.length === 0) {
      return
    }

    let cancelled = false

    const hydrateCategories = async () => {
      for (const customization of categoriesToHydrate) {
        if (cancelled) return
        if (loadingCategories.has(customization.categoryId)) continue

        setLoadingCategories(prev => new Set(prev).add(customization.categoryId))
        try {
          const services = await fetchServicesForCategory(customization.categoryId)
          if (cancelled) return

          setCustomizations(prev => prev.map((custom) =>
            custom.categoryId === customization.categoryId
              ? {
                  ...custom,
                  services
                }
              : custom
          ))
        } catch (error) {
          console.error(`Failed to auto-load services for ${customization.categoryName}:`, error)
        } finally {
          if (!cancelled) {
            setLoadingCategories(prev => {
              const next = new Set(prev)
              next.delete(customization.categoryId)
              return next
            })
          }
        }
      }
    }

    hydrateCategories()

    return () => {
      cancelled = true
    }
  }, [customizations, hasInitializedCustomizations, isSpecialServiceMode, loadingCategories, planCategories.length])

  // Load services for a category
  const loadServicesForCategory = async (categoryId: string) => {
    setLoadingCategories(prev => new Set(prev).add(categoryId))
    try {
      const services = await fetchServicesForCategory(categoryId)

      // Get category name
      const category = planCategories.find(c => c.id === categoryId)
      const categoryName = category?.name || categoryId

      // Get existing covered services for this category
      const existingServicesForCategory = existingCoveredServices.filter((cs: CoveredService) =>
        cs.service_type.service_category === categoryName
      )

      // Get selected service IDs - if no existing services, auto-select all
      const selectedServiceIds = existingServicesForCategory.length > 0
        ? existingServicesForCategory.map((cs: CoveredService) => cs.service_type_id)
        : services.map((s: any) => s.id) // Auto-check all services by default

      setCustomizations(prev => prev.map(custom =>
        custom.categoryId === categoryId
          ? {
            ...custom,
            services,
            selectedServices: selectedServiceIds
          }
          : custom
      ))

      if (services.length === 0) {
        toast({
          title: "No Services Found",
          description: `No services found for category "${categoryName}". Services will appear here when providers upload them.`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Services Loaded",
          description: `Loaded ${services.length} services (${selectedServiceIds.length} selected by default)`,
        })
      }
    } catch (error: any) {
      const category = planCategories.find(c => c.id === categoryId)
      const categoryName = category?.name || categoryId
      toast({
        title: "Error Loading Services",
        description: error.message || `Failed to load services for category "${categoryName}". Please try again.`,
        variant: "destructive",
      })
    } finally {
      setLoadingCategories(prev => {
        const newSet = new Set(prev)
        newSet.delete(categoryId)
        return newSet
      })
    }
  }

  // Handle service selection
  const handleServiceToggle = (categoryId: string, serviceId: string) => {
    setCustomizations(prev => prev.map(custom =>
      custom.categoryId === categoryId
        ? {
          ...custom,
          selectedServices: custom.selectedServices.includes(serviceId)
            ? custom.selectedServices.filter(id => id !== serviceId)
            : [...custom.selectedServices, serviceId]
        }
        : custom
    ))
  }

  // Handle "Add All" for a category
  const handleAddAllServices = (categoryId: string) => {
    setCustomizations(prev => prev.map(custom =>
      custom.categoryId === categoryId
        ? {
          ...custom,
          selectedServices: custom.services.map(service => service.id)
        }
        : custom
    ))
  }

  // Handle "Remove All" for a category
  const handleRemoveAllServices = (categoryId: string) => {
    setCustomizations(prev => prev.map(custom =>
      custom.categoryId === categoryId
        ? {
          ...custom,
          selectedServices: []
        }
        : custom
    ))
  }

  // Handle price limit change
  const handlePriceLimitChange = (categoryId: string, priceLimit: number) => {
    setCustomizations(prev => prev.map(custom =>
      custom.categoryId === categoryId
        ? { ...custom, priceLimit }
        : custom
    ))
  }

  // Handle frequency limit change
  const handleFrequencyLimitChange = (categoryId: string, frequencyLimit: number) => {
    setCustomizations(prev => prev.map(custom =>
      custom.categoryId === categoryId
        ? { ...custom, frequencyLimit }
        : custom
    ))
  }

  // Handle service-level limit change (price or frequency)
  const handleServiceLimitChange = (
    categoryId: string,
    serviceId: string,
    limitType: 'priceLimit' | 'frequencyLimit',
    value: number | undefined
  ) => {
    setCustomizations(prev => prev.map(custom => {
      if (custom.categoryId !== categoryId) return custom

      const updatedServiceLimits = {
        ...custom.serviceLimits,
        [serviceId]: {
          ...(custom.serviceLimits[serviceId] || {}),
          [limitType]: value
        }
      }

      return {
        ...custom,
        serviceLimits: updatedServiceLimits
      }
    }))
  }

  const updateSpecialConfig = (updater: (current: SpecialServiceConfig) => SpecialServiceConfig) => {
    setSpecialConfig((prev) => {
      if (!prev) return prev
      return updater(prev)
    })
  }

  const addSpecialCategory = () => {
    updateSpecialConfig((current) => ({
      ...current,
      table: {
        ...current.table,
        categories: [
          ...current.table.categories,
          {
            id: `cat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            title: "New Category",
            rows: [],
          },
        ],
      },
    }))
  }

  const removeSpecialCategory = (categoryId: string) => {
    updateSpecialConfig((current) => ({
      ...current,
      table: {
        ...current.table,
        categories: current.table.categories.filter((category) => category.id !== categoryId),
      },
    }))
  }

  const updateSpecialCategoryTitle = (categoryId: string, title: string) => {
    updateSpecialConfig((current) => ({
      ...current,
      table: {
        ...current.table,
        categories: current.table.categories.map((category) =>
          category.id === categoryId ? { ...category, title } : category
        ),
      },
    }))
  }

  const addSpecialRow = (categoryId: string) => {
    updateSpecialConfig((current) => ({
      ...current,
      table: {
        ...current.table,
        categories: current.table.categories.map((category) => {
          if (category.id !== categoryId) return category
          return {
            ...category,
            rows: [
              ...category.rows,
              {
                id: `row-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                serviceName: "",
                values: current.table.columns.reduce<Record<string, string>>((acc, column) => {
                  acc[column] = ""
                  return acc
                }, {}),
              },
            ],
          }
        }),
      },
    }))
  }

  const removeSpecialRow = (categoryId: string, rowId: string) => {
    updateSpecialConfig((current) => ({
      ...current,
      table: {
        ...current.table,
        categories: current.table.categories.map((category) => {
          if (category.id !== categoryId) return category
          return {
            ...category,
            rows: category.rows.filter((row) => row.id !== rowId),
          }
        }),
      },
    }))
  }

  const updateSpecialRowServiceName = (categoryId: string, rowId: string, serviceName: string) => {
    updateSpecialConfig((current) => ({
      ...current,
      table: {
        ...current.table,
        categories: current.table.categories.map((category) => {
          if (category.id !== categoryId) return category
          return {
            ...category,
            rows: category.rows.map((row) => (row.id === rowId ? { ...row, serviceName } : row)),
          }
        }),
      },
    }))
  }

  const updateSpecialRowCell = (categoryId: string, rowId: string, column: string, value: string) => {
    updateSpecialConfig((current) => ({
      ...current,
      table: {
        ...current.table,
        categories: current.table.categories.map((category) => {
          if (category.id !== categoryId) return category
          return {
            ...category,
            rows: category.rows.map((row) =>
              row.id === rowId
                ? {
                    ...row,
                    values: {
                      ...row.values,
                      [column]: value,
                    },
                  }
                : row
            ),
          }
        }),
      },
    }))
  }

  const addTierColumn = () => {
    const value = newTierColumn.trim()
    if (!value || !specialConfig) return

    const exists = specialConfig.table.columns.some((column) => column.toLowerCase() === value.toLowerCase())
    if (exists) {
      toast({
        title: "Column already exists",
        description: `"${value}" has already been added`,
        variant: "destructive",
      })
      return
    }

    updateSpecialConfig((current) => ({
      ...current,
      hospitalTiers: [...current.hospitalTiers, value],
      table: {
        ...current.table,
        columns: [...current.table.columns, value],
        categories: current.table.categories.map((category) => ({
          ...category,
          rows: category.rows.map((row) => ({
            ...row,
            values: {
              ...row.values,
              [value]: "",
            },
          })),
        })),
      },
    }))
    setNewTierColumn("")
  }

  const removeTierColumn = (columnName: string) => {
    updateSpecialConfig((current) => ({
      ...current,
      hospitalTiers: current.hospitalTiers.filter((tier) => tier !== columnName),
      table: {
        ...current.table,
        columns: current.table.columns.filter((column) => column !== columnName),
        categories: current.table.categories.map((category) => ({
          ...category,
          rows: category.rows.map((row) => {
            const nextValues = { ...row.values }
            delete nextValues[columnName]
            return {
              ...row,
              values: nextValues,
            }
          }),
        })),
      },
    }))
  }

  const syncColumnsToPlanNames = (plans: SpecialServicePlanColumn[], current: SpecialServiceConfig) => {
    const nextColumns = plans.map((planColumn, idx) => {
      const candidate = planColumn.name.trim()
      return candidate || `Plan ${idx + 1}`
    })

    const previousColumns = current.table.columns
    const migrationPairs = previousColumns.map((oldColumn, index) => ({
      oldColumn,
      newColumn: nextColumns[index] || oldColumn,
    }))

    const migratedCategories = current.table.categories.map((category) => ({
      ...category,
      rows: category.rows.map((row) => {
        const nextValues: Record<string, string> = {}
        migrationPairs.forEach(({ oldColumn, newColumn }) => {
          nextValues[newColumn] = row.values?.[oldColumn] || ""
        })
        return {
          ...row,
          values: nextValues,
        }
      }),
    }))

    return {
      ...current,
      plans,
      table: {
        ...current.table,
        columns: nextColumns,
        categories: migratedCategories,
      },
    }
  }

  const addSpecialPlan = () => {
    updateSpecialConfig((current) => {
      if (current.plans.length >= 4) {
        toast({
          title: "Maximum reached",
          description: "You can only add up to 4 plans",
          variant: "destructive",
        })
        return current
      }
      const nextPlans = [
        ...current.plans,
        {
          id: `plan-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: `Plan ${current.plans.length + 1}`,
          individualPrice: 0,
          familyPrice: 0,
          individualLimit: null,
          familyLimit: null,
          individualUnlimited: false,
          familyUnlimited: false,
          hospitalTiers: [],
        },
      ]
      return syncColumnsToPlanNames(nextPlans, current)
    })
  }

  const removeSpecialPlan = (planIdToRemove: string) => {
    updateSpecialConfig((current) => {
      const nextPlans = current.plans.filter((planColumn) => planColumn.id !== planIdToRemove)
      return syncColumnsToPlanNames(nextPlans, current)
    })
  }

  const updateSpecialPlan = (
    planIdToUpdate: string,
    updater: (planColumn: SpecialServicePlanColumn) => SpecialServicePlanColumn
  ) => {
    updateSpecialConfig((current) => {
      const nextPlans = current.plans.map((planColumn) =>
        planColumn.id === planIdToUpdate ? updater(planColumn) : planColumn
      )
      return syncColumnsToPlanNames(nextPlans, current)
    })
  }

  const saveSpecialServiceConfig = async (options?: { silent?: boolean }) => {
    if (!specialConfig) return false
    const silent = Boolean(options?.silent)
    if (!silent) setManualSaving(true)
    setAutoSaveState("saving")
    try {
      const response = await fetch(`/api/underwriting/plans/${planId}/customize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specialServiceConfig: specialConfig }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save custom plan draft")
      }
      lastSavedSpecialSnapshotRef.current = JSON.stringify(specialConfig)
      setAutoSaveState("saved")
      if (!silent) {
        toast({
          title: "Saved",
          description: "Custom plan saved successfully.",
        })
      }
      return true
    } catch (error: any) {
      setAutoSaveState("error")
      if (!silent) {
        toast({
          title: "Error",
          description: error?.message || "Failed to save custom plan",
          variant: "destructive",
        })
      }
      return false
    } finally {
      if (!silent) setManualSaving(false)
    }
  }

  useEffect(() => {
    if (!isSpecialServiceMode || !specialConfig || !specialConfigInitializedRef.current) return
    const currentSnapshot = JSON.stringify(specialConfig)
    if (currentSnapshot === lastSavedSpecialSnapshotRef.current) return

    const timer = setTimeout(() => {
      void saveSpecialServiceConfig({ silent: true })
    }, 1200)

    return () => clearTimeout(timer)
  }, [isSpecialServiceMode, planId, specialConfig])

  // Save customization
  const saveCustomizationMutation = useMutation({
    mutationFn: async (customizationData: any) => {
      const res = await fetch(`/api/underwriting/plans/${planId}/customize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customizationData)
      })

      const rawResponse = await res.text()
      let data: any = null

      try {
        data = rawResponse ? JSON.parse(rawResponse) : null
      } catch {
        data = null
      }

      if (!res.ok) {
        const errorMessage = data?.details
          ? Array.isArray(data.details)
            ? data.details.join(', ')
            : data.details
          : data?.error || data?.message || rawResponse || 'Failed to save customization'
        throw new Error(errorMessage)
      }

      if (!data) {
        throw new Error("Server returned an invalid response while saving customization")
      }

      return data
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Plan customization saved successfully",
      })
      setHasInitializedCustomizations(false)
      queryClient.invalidateQueries({ queryKey: ["covered-services", planId] })
      queryClient.invalidateQueries({ queryKey: ["plan-customization", planId] })
    },
    onError: (error: any) => {
      console.error('Save customization error:', error)
      let errorMessage = "Failed to save customization"

      if (error?.response) {
        // Handle API error response
        const errorData = error.response
        if (errorData.details && Array.isArray(errorData.details)) {
          errorMessage = `Validation errors: ${errorData.details.join(', ')}`
        } else if (errorData.error) {
          errorMessage = errorData.error
        } else if (errorData.message) {
          errorMessage = errorData.message
        }
      } else if (error?.message) {
        errorMessage = error.message
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    },
  })

  const handleSaveCustomization = () => {
    if (isSpecialServiceMode) {
      if (!specialConfig) {
        toast({
          title: "Error",
          description: "Special service configuration is not ready",
          variant: "destructive",
        })
        return
      }

      if (specialConfig.accountTypes.length === 0) {
        toast({
          title: "Validation Error",
          description: "Add at least one account type",
          variant: "destructive",
        })
        return
      }

      void saveSpecialServiceConfig()
      return
    }

    // Filter out customizations with no selected services and no limits
    const customizationData = {
      customizations: customizations
        .filter(custom =>
          custom.selectedServices.length > 0 ||
          custom.priceLimit !== undefined ||
          custom.frequencyLimit !== undefined ||
          Object.keys(custom.serviceLimits || {}).length > 0
        )
        .map(custom => ({
          categoryId: custom.categoryId,
          categoryName: custom.categoryName,
          selectedServices: custom.selectedServices,
          priceLimit: custom.priceLimit ?? undefined,
          frequencyLimit: custom.frequencyLimit ?? undefined,
          serviceLimits: custom.serviceLimits || {} // Include service-level limits
        }))
    }

    console.log('Saving customization data:', customizationData)
    saveCustomizationMutation.mutate(customizationData)
  }

  const plan: Plan = planData?.plan
  const canSendToSpecialService =
    returnTo.includes("/underwriting/") &&
    (plan?.status === "DRAFT" || plan?.status === "IN_PROGRESS")
  const canSendToMdFromSpecialService =
    returnTo.includes("/special-risk/") &&
    (plan?.status === "DRAFT" || plan?.status === "IN_PROGRESS" || plan?.status === "PENDING_APPROVAL")
  const exportRoute = returnTo.includes("/special-risk/")
    ? `/api/special-risk/plans/${planId}/export`
    : returnTo.includes("/executive-desk/")
      ? `/api/executive-desk/plans/${planId}/export`
      : `/api/underwriting/plans/${planId}/export`

  const submitToSpecialServiceMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/underwriting/plans/${planId}/submit`, {
        method: "POST",
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || "Failed to send plan to Special Services")
      return payload
    },
    onSuccess: () => {
      toast({
        title: "Sent",
        description: "Plan sent to Special Services successfully.",
      })
      queryClient.invalidateQueries({ queryKey: ["plan", planId] })
      router.push("/underwriting/custom-plans")
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to send plan to Special Services",
        variant: "destructive",
      })
    },
  })

  const sendToMdMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/special-risk/plans/${planId}/send-to-md`, {
        method: "POST",
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || "Failed to send plan to MD")
      return payload
    },
    onSuccess: () => {
      toast({
        title: "Sent",
        description: "Plan sent to MD successfully.",
      })
      queryClient.invalidateQueries({ queryKey: ["plan", planId] })
      router.push("/special-risk/custom-plans")
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to send plan to MD",
        variant: "destructive",
      })
    },
  })
  const isCustomizationSetupLoading = isSpecialServiceMode
    ? isCustomizationLoading || !specialConfig
    : (isCategoriesLoading || isCustomizationLoading || isCoveredServicesLoading || !hasInitializedCustomizations)

  if (planLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600">Plan not found</p>
        <Button onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push(returnTo)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Plan Customization</h1>
            <p className="text-gray-600 mt-1">{stageLabel}: customize services and pricing for {plan.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSaveCustomization}
            disabled={saveCustomizationMutation.isPending || manualSaving}
            className="bg-[#BE1522] hover:bg-[#9B1219]"
          >
            <Save className="h-4 w-4 mr-2" />
            {(saveCustomizationMutation.isPending || manualSaving) ? "Saving..." : "Save Customization"}
          </Button>
          {canSendToSpecialService && (
            <Button
              onClick={() => submitToSpecialServiceMutation.mutate()}
              disabled={submitToSpecialServiceMutation.isPending}
              variant="outline"
            >
              <Send className="h-4 w-4 mr-2" />
              {submitToSpecialServiceMutation.isPending ? "Sending..." : "Send to Special Service"}
            </Button>
          )}
          {canSendToMdFromSpecialService && (
            <Button
              onClick={() => sendToMdMutation.mutate()}
              disabled={sendToMdMutation.isPending}
              variant="outline"
            >
              <Send className="h-4 w-4 mr-2" />
              {sendToMdMutation.isPending ? "Sending..." : "Send to MD"}
            </Button>
          )}
        </div>
      </div>

      {/* Categories and Services */}
      <div className="space-y-6">
        {isCustomizationSetupLoading ? (
          <Card>
            <CardContent className="py-10">
              <div className="flex items-center justify-center gap-3 text-gray-500">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-[#BE1522]"></div>
                <span>Loading saved plan configuration...</span>
              </div>
            </CardContent>
          </Card>
        ) : isSpecialServiceMode && specialConfig ? (
          <div className="space-y-4">
            <Input
              placeholder="Plan Name (e.g Senior Plan)"
              value={editablePlanName}
              onChange={(e) => setEditablePlanName(e.target.value)}
              onBlur={persistPlanName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur()
                }
              }}
            />

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-[#BE1522] text-xl">Plans</CardTitle>
                  <Button onClick={addSpecialPlan} className="bg-[#BE1522] hover:bg-[#9B1219]">
                    + Add Plan
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="mb-2 flex items-center justify-between gap-3 rounded border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <span>
                    Auto-save:
                    {autoSaveState === "saving" && " saving draft..."}
                    {autoSaveState === "saved" && " draft saved"}
                    {autoSaveState === "error" && " failed (use Save button)"}
                    {autoSaveState === "idle" && " ready"}
                    {savingPlanName && " • updating plan name..."}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleSaveCustomization} disabled={manualSaving}>
                      Save
                    </Button>
                    {canSendToSpecialService && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => submitToSpecialServiceMutation.mutate()}
                        disabled={submitToSpecialServiceMutation.isPending}
                      >
                        Send to Special Service
                      </Button>
                    )}
                    {canSendToMdFromSpecialService && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendToMdMutation.mutate()}
                        disabled={sendToMdMutation.isPending}
                      >
                        Send to MD
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {specialConfig.plans.map((planColumn, index) => (
                    <Card key={planColumn.id} className="border border-gray-200">
                      <CardContent className="space-y-3 pt-4">
                        <Input
                          value={planColumn.name}
                          placeholder={`Plan ${index + 1} name`}
                          onChange={(e) =>
                            updateSpecialPlan(planColumn.id, (currentPlan) => ({
                              ...currentPlan,
                              name: e.target.value,
                            }))
                          }
                        />

                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">Individual Price</Label>
                          <Input
                            type="number"
                            value={planColumn.individualPrice > 0 ? planColumn.individualPrice : ""}
                            placeholder="Enter individual price"
                            onChange={(e) =>
                              updateSpecialPlan(planColumn.id, (currentPlan) => ({
                                ...currentPlan,
                                individualPrice: Number(e.target.value || 0),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">Family Price</Label>
                          <Input
                            type="number"
                            value={planColumn.familyPrice > 0 ? planColumn.familyPrice : ""}
                            placeholder="Enter family price"
                            onChange={(e) =>
                              updateSpecialPlan(planColumn.id, (currentPlan) => ({
                                ...currentPlan,
                                familyPrice: Number(e.target.value || 0),
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">Individual Limit</Label>
                          <Input
                            type="number"
                            value={planColumn.individualLimit && planColumn.individualLimit > 0 ? planColumn.individualLimit : ""}
                            disabled={planColumn.individualUnlimited}
                            placeholder="Enter individual limit"
                            onChange={(e) =>
                              updateSpecialPlan(planColumn.id, (currentPlan) => ({
                                ...currentPlan,
                                individualLimit: e.target.value ? Number(e.target.value) : null,
                              }))
                            }
                          />
                          <label className="flex items-center gap-2 text-xs">
                            <Checkbox
                              checked={planColumn.individualUnlimited}
                              onCheckedChange={(checked) =>
                                updateSpecialPlan(planColumn.id, (currentPlan) => ({
                                  ...currentPlan,
                                  individualUnlimited: Boolean(checked),
                                  individualLimit: Boolean(checked) ? null : currentPlan.individualLimit,
                                }))
                              }
                            />
                            Unlimited
                          </label>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">Family Limit</Label>
                          <Input
                            type="number"
                            value={planColumn.familyLimit && planColumn.familyLimit > 0 ? planColumn.familyLimit : ""}
                            disabled={planColumn.familyUnlimited}
                            placeholder="Enter family limit"
                            onChange={(e) =>
                              updateSpecialPlan(planColumn.id, (currentPlan) => ({
                                ...currentPlan,
                                familyLimit: e.target.value ? Number(e.target.value) : null,
                              }))
                            }
                          />
                          <label className="flex items-center gap-2 text-xs">
                            <Checkbox
                              checked={planColumn.familyUnlimited}
                              onCheckedChange={(checked) =>
                                updateSpecialPlan(planColumn.id, (currentPlan) => ({
                                  ...currentPlan,
                                  familyUnlimited: Boolean(checked),
                                  familyLimit: Boolean(checked) ? null : currentPlan.familyLimit,
                                }))
                              }
                            />
                            Unlimited
                          </label>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">Hospital Tiers</Label>
                          <Input
                            value={(planColumn.hospitalTiers || []).join(", ")}
                            placeholder="e.g. Band C"
                            onChange={(e) =>
                              updateSpecialPlan(planColumn.id, (currentPlan) => ({
                                ...currentPlan,
                                hospitalTiers: toStringArray(e.target.value),
                              }))
                            }
                          />
                          <p className="text-[10px] text-gray-500 italic">Attach tiers for this plan only (comma-separated)</p>
                        </div>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeSpecialPlan(planColumn.id)}
                          disabled={specialConfig.plans.length <= 1}
                        >
                          Remove
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Region of Cover</Label>
                    <Input
                      value={specialConfig.regionOfCover}
                      onChange={(e) =>
                        updateSpecialConfig((current) => ({
                          ...current,
                          regionOfCover: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-[#BE1522] text-xl">Benefits</CardTitle>
                  <Button onClick={addSpecialCategory} className="bg-[#BE1522] hover:bg-[#9B1219]">
                    + Add Category
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {specialConfig.table.categories.length === 0 && (
                  <div className="border border-dashed rounded-md py-8 text-center text-sm text-gray-500">
                    No categories yet. Click + Add Category.
                  </div>
                )}

                {specialConfig.table.categories.map((category) => (
                  <Card key={category.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <Input
                          value={category.title}
                          onChange={(e) => updateSpecialCategoryTitle(category.id, e.target.value)}
                          className="font-semibold text-base max-w-md"
                        />
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => addSpecialRow(category.id)}>
                            Add Service Row
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => removeSpecialCategory(category.id)}>
                            Remove Category
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[260px]">Services</TableHead>
                              {specialConfig.table.columns.map((column) => (
                                <TableHead key={`${category.id}-${column}`} className="min-w-[180px]">
                                  {column}
                                </TableHead>
                              ))}
                              <TableHead className="w-20">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {category.rows.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={specialConfig.table.columns.length + 2} className="text-center text-gray-500 py-6">
                                  No services added yet for this category
                                </TableCell>
                              </TableRow>
                            ) : (
                              category.rows.map((row) => (
                                <TableRow key={row.id}>
                                  <TableCell>
                                    <Input
                                      value={row.serviceName}
                                      placeholder="Type service name"
                                      onChange={(e) => updateSpecialRowServiceName(category.id, row.id, e.target.value)}
                                    />
                                  </TableCell>
                                  {specialConfig.table.columns.map((column) => (
                                    <TableCell key={`${row.id}-${column}`}>
                                      <Input
                                        value={row.values[column] || ""}
                                        placeholder="Covered / Limit"
                                        onChange={(e) => updateSpecialRowCell(category.id, row.id, column, e.target.value)}
                                      />
                                    </TableCell>
                                  ))}
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-600"
                                      onClick={() => removeSpecialRow(category.id, row.id)}
                                    >
                                      Remove
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>

            <Button className="w-full bg-emerald-700 hover:bg-emerald-800" onClick={handleSaveCustomization} disabled={manualSaving}>
              Generate Output
            </Button>
            <Button
              className="w-full bg-[#BE1522] hover:bg-[#9B1219]"
              onClick={() => {
                window.location.href = exportRoute
              }}
            >
              Export to Excel
            </Button>
          </div>
        ) : (
        <>
        {customizations.map((customization) => (
          <Card key={customization.categoryId}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{customization.categoryName}</CardTitle>
                  <CardDescription>
                    {customization.selectedServices.length} service{customization.selectedServices.length === 1 ? "" : "s"} checked
                    {customization.selectedServices.length > 0 && (
                      <span className="text-green-600 ml-2">
                        • ready for this category
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadServicesForCategory(customization.categoryId)}
                    disabled={loadingCategories.has(customization.categoryId)}
                    className="text-green-600 hover:text-green-700"
                  >
                    {loadingCategories.has(customization.categoryId) ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-green-600 mr-1"></div>
                        Loading...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" />
                        {customization.selectedServices.length > 0 ? 'Reload Services' : 'Load Services'}
                      </>
                    )}
                  </Button>
                  {customization.services.length > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddAllServices(customization.categoryId)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        Add All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveAllServices(customization.categoryId)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Remove All
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Category Limits */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <Label htmlFor={`price-limit-${customization.categoryId}`} className="flex items-center gap-2 text-blue-600 font-semibold">
                    <DollarSign className="h-4 w-4" />
                    Price Limit for {customization.categoryName} (₦)
                  </Label>
                  <Input
                    id={`price-limit-${customization.categoryId}`}
                    type="number"
                    placeholder="Enter price limit"
                    value={customization.priceLimit || ""}
                    onChange={(e) => handlePriceLimitChange(customization.categoryId, parseFloat(e.target.value) || 0)}
                    className="border-blue-200 focus:ring-red-700"
                  />
                  <p className="text-[10px] text-gray-500 italic">Sets the maximum total amount allowed for this category</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`frequency-limit-${customization.categoryId}`} className="flex items-center gap-2 text-purple-600 font-semibold">
                    <Settings className="h-4 w-4" />
                    Frequency Limit for {customization.categoryName}
                  </Label>
                  <Input
                    id={`frequency-limit-${customization.categoryId}`}
                    type="number"
                    placeholder="Enter frequency limit (e.g., 2)"
                    value={customization.frequencyLimit || ""}
                    onChange={(e) => handleFrequencyLimitChange(customization.categoryId, parseInt(e.target.value) || 0)}
                    className="border-purple-200 focus:ring-purple-500"
                  />
                  <p className="text-[10px] text-gray-500 italic">Sets how many times services in this category can be accessed</p>
                </div>
              </div>

              {/* Services List */}
              {customization.services.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      Services ({customization.selectedServices.length} selected)
                    </Label>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">
                        {customization.selectedServices.length} selected
                      </span>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Select</TableHead>
                          <TableHead>Service Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Price Limit (₦)</TableHead>
                          <TableHead>Frequency Limit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customization.services
                          .filter(service =>
                            service.service_name.toLowerCase().includes(searchTerm.toLowerCase())
                          )
                          .map((service) => {
                            const serviceLimit = customization.serviceLimits[service.id] || {}
                            return (
                              <TableRow key={service.id}>
                                <TableCell>
                                  <Checkbox
                                    checked={customization.selectedServices.includes(service.id)}
                                    onCheckedChange={() => handleServiceToggle(customization.categoryId, service.id)}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">
                                  {service.service_name}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {service.service_category}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {service.service_type && (
                                    <Badge variant="secondary">
                                      {service.service_type}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={serviceLimit.priceLimit || ""}
                                    onChange={(e) => handleServiceLimitChange(
                                      customization.categoryId,
                                      service.id,
                                      'priceLimit',
                                      parseFloat(e.target.value) || undefined
                                    )}
                                    className="w-32"
                                    disabled={!customization.selectedServices.includes(service.id)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    placeholder="0"
                                    value={serviceLimit.frequencyLimit || ""}
                                    onChange={(e) => handleServiceLimitChange(
                                      customization.categoryId,
                                      service.id,
                                      'frequencyLimit',
                                      parseInt(e.target.value) || undefined
                                    )}
                                    className="w-32"
                                    disabled={!customization.selectedServices.includes(service.id)}
                                  />
                                </TableCell>
                              </TableRow>
                            )
                          })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Settings className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Click "Load Services" to see available services for this category</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        </>
        )}
      </div>

      {!isSpecialServiceMode && (
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search services across all categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
