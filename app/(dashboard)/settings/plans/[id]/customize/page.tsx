"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { 


  ArrowLeft,
  Search,
  Plus,
  Minus,
  DollarSign,
  Settings,
  CheckCircle,
  XCircle
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
  serviceLimits: Record<string, ServiceLimit> // Service-level limits (price + frequency)
}

export default function PlanCustomizationPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const params = useParams()
  const router = useRouter()
  const planId = params.id as string

  const [searchTerm, setSearchTerm] = useState("")
  const [customizations, setCustomizations] = useState<PlanCustomization[]>([])
  const [planCategories, setPlanCategories] = useState<PlanCategory[]>([])
  const [loadingCategories, setLoadingCategories] = useState<Set<string>>(new Set())

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
        const response = await fetch('/plan_categories.json')
        const categories: PlanCategory[] = await response.json()
        setPlanCategories(categories)
        
        // Initialize customizations for each category
        const initialCustomizations = categories.map(category => ({
          categoryId: category.id,
          categoryName: category.name,
          services: [],
          selectedServices: [],
          priceLimit: undefined,
          serviceLimits: {} as Record<string, ServiceLimit>
        }))
        setCustomizations(initialCustomizations)
      } catch (error) {
        console.error('Error fetching plan categories:', error)
      }
    }
    
    fetchPlanCategories()
  }, [])

  // Fetch service types for a specific category - load ALL services without pagination
  const fetchServicesForCategory = async (categoryId: string) => {
    try {
      // Get category name from planCategories to ensure correct mapping
      const category = planCategories.find(c => c.id === categoryId)
      const categoryName = category?.name || categoryId
      
      console.log('Fetching services for category:', { categoryId, categoryName })
      
      // Use very high limit and page=1 to get all services
      // Try with category ID first (API expects ID like "CON", "LAB", etc.)
      let res = await fetch(`/api/settings/service-types?category=${categoryId}&limit=50000&page=1`)
      
      // If that fails or returns no results, try with category name
      if (!res.ok) {
        console.log('Trying with category name instead of ID')
        res = await fetch(`/api/settings/service-types?category=${encodeURIComponent(categoryName)}&limit=50000&page=1`)
      }
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error('API error response:', errorText)
        throw new Error(`Failed to fetch services: ${res.status} ${res.statusText}`)
      }
      
      const data = await res.json()
      const services = data.serviceTypes || []
      const totalCount = data.totalCount || 0
      
      console.log(`Loaded ${services.length} services (total: ${totalCount}) for category ${categoryName}`)
      
      // If we got fewer services than total, log a warning
      if (totalCount > services.length) {
        console.warn(`Warning: Only fetched ${services.length} of ${totalCount} services. Some services may be missing.`)
      }
      
      if (services.length === 0) {
        console.warn(`No services found for category: ${categoryName} (ID: ${categoryId})`)
      }
      
      return services
    } catch (error) {
      console.error('Error fetching services for category:', error)
      throw error // Re-throw to let the calling function handle it
    }
  }

  // Fetch existing customization data (includes service limits)
  const { data: customizationData } = useQuery({
    queryKey: ["plan-customization", planId],
    queryFn: async () => {
      const res = await fetch(`/api/underwriting/plans/${planId}/customize`)
      if (!res.ok) throw new Error("Failed to fetch customization")
      return res.json()
    },
    enabled: !!planId
  })

  // Fetch existing covered services for this plan
  const { data: coveredServicesData } = useQuery({
    queryKey: ["covered-services", planId],
    queryFn: async () => {
      const res = await fetch(`/api/settings/covered-services?plan_id=${planId}`)
      if (!res.ok) throw new Error("Failed to fetch covered services")
      return res.json()
    }
  })

  // Get existing covered services
  const existingCoveredServices = coveredServicesData?.covered_services || []

  // Auto-load existing customization when data is available
  useEffect(() => {
    if (customizationData?.customizations && customizations.length > 0) {
      setCustomizations(prev => prev.map(custom => {
        const existingCustom = customizationData.customizations.find(
          (c: any) => c.categoryId === custom.categoryId || c.categoryName === custom.categoryName
        )
        
        if (existingCustom) {
          return {
            ...custom,
            selectedServices: existingCustom.selectedServices || [],
            priceLimit: existingCustom.priceLimit,
            serviceLimits: existingCustom.serviceLimits || {}
          }
        }
        return custom
      }))
    } else if (existingCoveredServices.length > 0 && customizations.length > 0) {
      // Fallback: Group existing services by category
      const servicesByCategory = new Map<string, string[]>()
      
      existingCoveredServices.forEach((cs: CoveredService) => {
        const categoryName = cs.service_type.service_category
        
        // Find matching category ID using dynamic category mapping
        const category = planCategories.find(c => c.name === categoryName)
        if (category) {
          const categoryId = category.id
          if (!servicesByCategory.has(categoryId)) {
            servicesByCategory.set(categoryId, [])
          }
          servicesByCategory.get(categoryId)!.push(cs.service_type_id)
        }
      })
      
      // Update customizations with existing selections
      setCustomizations(prev => prev.map(custom => {
        const existingSelections = servicesByCategory.get(custom.categoryId) || []
        return {
          ...custom,
          selectedServices: existingSelections
        }
      }))
    }
  }, [customizationData, existingCoveredServices, customizations.length, planCategories])

  // Load services for a category
  const loadServicesForCategory = async (categoryId: string) => {
    setLoadingCategories(prev => new Set(prev).add(categoryId))
    try {
      const services = await fetchServicesForCategory(categoryId)
      
      // Get existing covered services for this category using dynamic category mapping
      const category = planCategories.find(c => c.id === categoryId)
      const categoryName = category?.name || categoryId
      
      const existingServicesForCategory = existingCoveredServices.filter((cs: CoveredService) => 
        cs.service_type.service_category === categoryName
      )
      
      // Get selected service IDs for this category
      const selectedServiceIds = existingServicesForCategory.map((cs: CoveredService) => cs.service_type_id)
      
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
          description: `No services found for category "${categoryName}". Please check if services exist in this category.`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Services Loaded",
          description: `Loaded ${services.length} services for this category (${selectedServiceIds.length} already selected)`,
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

  // Save customization
  const saveCustomizationMutation = useMutation({
    mutationFn: async (customizationData: any) => {
            const res = await fetch(`/api/underwriting/plans/${planId}/customize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customizationData)
      })
      if (!res.ok) throw new Error('Failed to save customization')
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Plan customization saved successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["covered-services", planId] })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save customization",
        variant: "destructive",
      })
    },
  })

  const handleSaveCustomization = () => {
    const customizationData = {
      customizations: customizations.map(custom => ({
        categoryId: custom.categoryId,
        categoryName: custom.categoryName,
        selectedServices: custom.selectedServices,
        priceLimit: custom.priceLimit,
        serviceLimits: custom.serviceLimits // Include service-level limits
      }))
    }
    saveCustomizationMutation.mutate(customizationData)
  }

  const plan: Plan = planData?.plan

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
            onClick={() => router.push('/underwriting/plans')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Plans
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Plan Customization</h1>
            <p className="text-gray-600 mt-1">Customize services and pricing for {plan.name}</p>
          </div>
        </div>
        <Button 
          onClick={handleSaveCustomization}
          disabled={saveCustomizationMutation.isPending}
          className="bg-[#BE1522] hover:bg-[#9B1219]"
        >
          {saveCustomizationMutation.isPending ? "Saving..." : "Save Customization"}
        </Button>
      </div>

      {/* Plan Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Plan Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-500">Plan Name</Label>
              <p className="text-sm font-medium">{plan.name}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-500">Plan Type</Label>
              <Badge className="bg-blue-100 text-blue-800">{plan.plan_type}</Badge>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-500">Premium Amount</Label>
              <p className="text-sm font-medium">₦{plan.premium_amount.toLocaleString()}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-500">Annual Limit</Label>
              <p className="text-sm font-medium">₦{plan.annual_limit.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories and Services */}
      <div className="space-y-6">
        {customizations.map((customization) => (
          <Card key={customization.categoryId}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{customization.categoryName}</CardTitle>
                  <CardDescription>
                    {customization.services.length} services available
                    {customization.selectedServices.length > 0 && (
                      <span className="text-green-600 ml-2">
                        • {customization.selectedServices.length} selected
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
              {/* Price Limit */}
              <div className="mb-4">
                <Label htmlFor={`price-limit-${customization.categoryId}`} className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Price Limit for {customization.categoryName} (₦)
                </Label>
                <Input
                  id={`price-limit-${customization.categoryId}`}
                  type="number"
                  placeholder="Enter price limit"
                  value={customization.priceLimit || ""}
                  onChange={(e) => handlePriceLimitChange(customization.categoryId, parseFloat(e.target.value) || 0)}
                  className="max-w-xs"
                />
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
      </div>

      {/* Search */}
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
    </div>
  )
}
