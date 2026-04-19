"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusIndicator } from "@/components/ui/status-indicator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  Filter,
  Upload,
  Download,
  Plus,
  MoreHorizontal,
  DollarSign,
  FileText,
  Settings,
  ChevronRight,
  Package,
  XCircle,
  Edit,
  Trash2,
  CheckCircle
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { BulkUploadModal } from "@/components/ui/bulk-upload-modal"
import { X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { CategorySidebar } from "@/components/provider/category-sidebar"
import { ServiceListPanel } from "@/components/provider/service-list-panel"

interface PlanCategory {
  name: string
  id: string
}

interface ServiceType {
  id: string
  service_id: string
  service_name: string
  service_category: string
  service_type: string
  status: string
}

interface TariffPlanService {
  id: string
  service_id: string
  service_name: string
  category_id: string
  category_name: string
  price: number
  is_primary: boolean
  is_secondary: boolean
  status: string
  created_at: string
  updated_at: string
}

interface TariffPlanTabProps {
  providerId: string
}

interface TariffPlan {
  id: string
  provider_id: string
  is_customized: boolean
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "COMPLETE"
  approval_stage: "UNDERWRITING" | "SPECIAL_RISK" | "MD" | "COMPLETE"
  version: number
  submitted_at: string | null
  approved_at: string | null
  approved_by_id: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
  approved_by?: {
    id: string
    first_name: string
    last_name: string
    email: string
  } | null
  _count?: {
    tariff_plan_services: number
  }
}

export function TariffPlanTab({ providerId }: TariffPlanTabProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // All hooks must be declared before any conditional returns (Rules of Hooks)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const scrollPositionRef = useRef<number>(0)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [editingService, setEditingService] = useState<TariffPlanService | null>(null)
  const [viewingService, setViewingService] = useState<TariffPlanService | null>(null)
  const [planCategories, setPlanCategories] = useState<PlanCategory[]>([])
  const [tariffPlan, setTariffPlan] = useState<TariffPlan | null>(null)
  const [limitForm, setLimitForm] = useState({
    limit_type: "CATEGORY_PRICE",
    category_id: "",
    service_id: "",
    price_limit: "",
    frequency_limit: ""
  })
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isSavingInProgress, setIsSavingInProgress] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCreatingVersion, setIsCreatingVersion] = useState(false)
  const [filterStatus, setFilterStatus] = useState("all")

  // Form state for add/edit
  const [formData, setFormData] = useState({
    service_id: "",
    service_name: "",
    category_id: "",
    price: 0,
    is_primary: false,
    is_secondary: false
  })

  // Service selection state
  const [serviceSearchTerm, setServiceSearchTerm] = useState("")
  const [debouncedServiceSearch, setDebouncedServiceSearch] = useState("")
  const [showServiceResults, setShowServiceResults] = useState(false)
  const [selectedService, setSelectedService] = useState<any>(null)

  // Fetch tariff plan status
  const { data: tariffPlanData, isLoading: isLoadingTariffPlan, error: tariffPlanError, refetch: refetchTariffPlan } = useQuery({
    queryKey: ["tariff-plan", providerId],
    queryFn: async () => {
      if (!providerId) {
        throw new Error("Provider ID is required")
      }
      const res = await fetch(`/api/provider/tariff-plan?providerId=${providerId}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to fetch tariff plan")
      }
      const data = await res.json()
      return data.tariffPlan
    },
    enabled: !!providerId, // Only fetch when providerId is available
    retry: 1, // Retry once on failure
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    refetchOnMount: true, // Refetch on mount
  })

  useEffect(() => {
    if (tariffPlanData) {
      setTariffPlan(tariffPlanData)
    }
  }, [tariffPlanData])

  // Restore scroll position after category change and DOM update
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM has updated after state change
    const restoreScroll = () => {
      if (scrollPositionRef.current > 0) {
        window.scrollTo({
          top: scrollPositionRef.current,
          behavior: 'instant' // Use 'instant' to avoid smooth scroll animation
        })
        // Reset the ref after restoring to avoid restoring on unrelated scrolls
        scrollPositionRef.current = 0
      }
    }

    // Use double requestAnimationFrame to ensure all DOM updates are complete
    requestAnimationFrame(() => {
      requestAnimationFrame(restoreScroll)
    })
  }, [selectedCategory])

  // Fetch plan categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/plan_categories.json')
        const categories = await response.json()
        setPlanCategories(categories)
      } catch (error) {
      }
    }
    fetchCategories()
  }, [])

  const planLimitTypes = [
    { value: "CATEGORY_PRICE", label: "Category Price Limit" },
    { value: "CATEGORY_FREQUENCY", label: "Category Frequency Limit" },
    { value: "SERVICE_PRICE", label: "Service Price Limit" },
    { value: "SERVICE_FREQUENCY", label: "Service Frequency Limit" }
  ]

  const { data: planSettingsData } = useQuery({
    queryKey: ["provider-plan-metadata", providerId],
    queryFn: async () => {
      if (!providerId) throw new Error("Provider ID is required")
      const res = await fetch("/api/underwriting/plans?limit=1000")
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to fetch plans")
      }
      const data = await res.json()
      const plan = (data.plans || []).find((p: any) =>
        (p.plan_providers || []).some((pp: any) => pp.provider_id === providerId || pp.provider?.id === providerId)
      )
      return plan || null
    },
    enabled: !!providerId,
    refetchOnWindowFocus: false
  })

  const planId = planSettingsData?.id

  const { data: planLimitsData, refetch: refetchPlanLimits } = useQuery({
    queryKey: ["plan-limits", planId],
    queryFn: async () => {
      if (!planId) return { planLimits: [] }
      const res = await fetch(`/api/settings/plan-limits?planId=${planId}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to fetch plan limits")
      }
      return res.json()
    },
    enabled: !!planId,
    refetchOnWindowFocus: false
  })

  const planLimits: any[] = planLimitsData?.planLimits || []
  const categoryLimits = planLimits.filter(limit => limit.limit_type.startsWith("CATEGORY"))
  const serviceLimits = planLimits.filter(limit => limit.limit_type.startsWith("SERVICE"))

  const callStageEndpoint = async (endpoint: string, successMessage: string) => {
    if (!tariffPlan?.id) return
    try {
      const res = await fetch(endpoint, { method: "POST" })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to advance stage")
      }
      toast({ title: successMessage })
      await refetchTariffPlan()
      queryClient.invalidateQueries({ queryKey: ["tariff-plan-services", providerId] })
    } catch (error) {
      toast({
        title: "Stage update failed",
        description: error instanceof Error ? error.message : "Unable to advance the plan stage",
        variant: "destructive"
      })
    }
  }


  const planLimitMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!planId) throw new Error("Plan ID is required for limit updates")
      const res = await fetch("/api/settings/plan-limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, plan_id: planId })
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to save limit")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Limit saved" })
      refetchPlanLimits()
      setLimitForm({
        limit_type: "CATEGORY_PRICE",
        category_id: "",
        service_id: "",
        price_limit: "",
        frequency_limit: ""
      })
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save limit", description: error.message, variant: "destructive" })
    }
  })

  const handleLimitSubmit = () => {
    if (limitForm.limit_type.startsWith("CATEGORY") && !limitForm.category_id) {
      toast({ title: "Validation error", description: "Select a category before saving", variant: "destructive" })
      return
    }
    if (limitForm.limit_type.startsWith("SERVICE") && !limitForm.service_id) {
      toast({ title: "Validation error", description: "Enter a service ID before saving", variant: "destructive" })
      return
    }

    planLimitMutation.mutate({
      limit_type: limitForm.limit_type,
      category_id: limitForm.category_id || undefined,
      service_id: limitForm.service_id || undefined,
      price_limit: limitForm.price_limit ? Number(limitForm.price_limit) : undefined,
      frequency_limit: limitForm.frequency_limit ? Number(limitForm.frequency_limit) : undefined
    })
  }

  // Debounced search for services
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedServiceSearch(serviceSearchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [serviceSearchTerm])

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showServiceResults) {
        const target = event.target as Element
        // Check if click is outside the search dropdown
        if (!target.closest('.service-search-dropdown')) {
          setShowServiceResults(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showServiceResults])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + N: Add new service
      if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault()
        if (!showAddForm && !showEditForm) {
          handleAddService()
        }
      }

      // Ctrl/Cmd + E: Export services
      if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
        event.preventDefault()
        exportServices().catch(console.error)
      }

      // Escape: Close modals
      if (event.key === 'Escape') {
        if (showAddForm) setShowAddForm(false)
        if (showEditForm) setShowEditForm(false)
        if (showViewModal) setShowViewModal(false)
        if (showBulkUpload) setShowBulkUpload(false)
        if (showServiceResults) setShowServiceResults(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showAddForm, showEditForm, showViewModal, showBulkUpload, showServiceResults])

  // Service selection handlers
  const handleServiceSearch = (value: string) => {
    setServiceSearchTerm(value)
    setShowServiceResults(true)
  }

  const handleSelectService = (service: any) => {

    setSelectedService(service)

    // Map service category name to category ID using planCategories
    const category = planCategories.find(c => c.name === service.service_category)
    // If category not found, try to use selectedCategory filter, otherwise default to 'OTH'
    let categoryId = category?.id
    if (!categoryId) {
      // Try to find by partial match or use selectedCategory if available
      if (selectedCategory && selectedCategory !== "all") {
        categoryId = selectedCategory
      } else {
        categoryId = 'OTH'
      }
    }

    const newFormData = {
      service_id: service.service_id,
      service_name: service.service_name,
      category_id: categoryId,
      price: showEditForm ? formData.price : 0, // Keep existing price only when editing
      is_primary: showEditForm ? formData.is_primary : false, // Keep existing values only when editing
      is_secondary: showEditForm ? formData.is_secondary : false // Keep existing values only when editing
    }

    setFormData(newFormData)

    setServiceSearchTerm(service.service_name)

    setShowServiceResults(false)

  }

  const handleClearService = () => {
    setSelectedService(null)
    setFormData(prev => ({
      ...prev,
      service_id: "",
      service_name: "",
      category_id: ""
    }))
    setServiceSearchTerm("")
    setShowServiceResults(false)
  }

  // Fetch service types
  const { data: serviceTypesData, isLoading: isLoadingServices } = useQuery({
    queryKey: ["service-types"],
    queryFn: async () => {
      const res = await fetch("/api/settings/service-types")
      if (!res.ok) throw new Error("Failed to fetch service types")
      return res.json()
    }
  })

  const serviceTypes: ServiceType[] = serviceTypesData?.serviceTypes || []

  // Fetch services for selection - filter by category if one is selected
  const { data: searchServicesData, isLoading: isLoadingSearchServices } = useQuery({
    queryKey: ["search-services", debouncedServiceSearch, selectedCategory],
    queryFn: async () => {
      if (!debouncedServiceSearch || debouncedServiceSearch.length < 2) return { serviceTypes: [] }

      const params = new URLSearchParams({
        search: debouncedServiceSearch
      })

      // Add category filter if a category is selected (and it's not "all")
      if (selectedCategory && selectedCategory !== "all") {
        params.append("category", selectedCategory)
      }

      const res = await fetch(`/api/settings/service-types?${params}`)
      if (!res.ok) throw new Error("Failed to fetch services")
      return res.json()
    },
    enabled: debouncedServiceSearch.length >= 2
  })

  const searchServices: ServiceType[] = searchServicesData?.serviceTypes || []

  // Fetch ALL tariff plan services for this provider (for category counts)
  const { data: allTariffServicesData, isLoading: isLoadingAllTariff } = useQuery({
    queryKey: ["tariff-plan-services-all", providerId],
    queryFn: async () => {
      if (!providerId) {
        throw new Error("Provider ID is required")
      }
      const params = new URLSearchParams()
      params.append('providerId', providerId)

      const res = await fetch(`/api/provider/tariff-plan/services?${params}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to fetch tariff plan services")
      }
      return res.json()
    },
    enabled: !!providerId, // Only fetch when providerId is available
    refetchOnWindowFocus: false, // Prevent refetch on window focus
  })

  // Fetch filtered tariff plan services for this provider (for display)
  const { data: tariffServicesData, isLoading: isLoadingTariff, error: tariffServicesError } = useQuery({
    queryKey: ["tariff-plan-services", providerId, selectedCategory, searchTerm],
    queryFn: async () => {
      if (!providerId) {
        throw new Error("Provider ID is required")
      }
      const params = new URLSearchParams()
      params.append('providerId', providerId)
      if (selectedCategory && selectedCategory !== "all") params.append('category', selectedCategory)
      if (searchTerm) params.append('search', searchTerm)

      const res = await fetch(`/api/provider/tariff-plan/services?${params}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to fetch tariff plan services")
      }
      return res.json()
    },
    enabled: !!providerId, // Only fetch when providerId is available
    refetchOnWindowFocus: false, // Prevent refetch on window focus
  })

  const allTariffServices: TariffPlanService[] = allTariffServicesData?.services || []
  const tariffServices: TariffPlanService[] = tariffServicesData?.services || []

  // Add service mutation - MUST be before early returns
  const addServiceMutation = useMutation({
    mutationFn: async (data: any) => {
      // Ensure category_id is set - use selectedCategory if not set in formData
      const categoryId = data.category_id || (selectedCategory && selectedCategory !== "all" ? selectedCategory : "")

      if (!categoryId) {
        throw new Error("Category is required. Please select a service or choose a category filter.")
      }

      const requestBody = {
        ...data,
        category_id: categoryId,
        provider_id: providerId
      }

      console.log("Adding service with data:", requestBody)

      const res = await fetch("/api/provider/tariff-plan/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      if (!res.ok) {
        let errorMessage = "Failed to add service"
        try {
          const errorData = await res.json()
          errorMessage = errorData.error || errorData.message || errorMessage
        } catch {
          // If JSON parsing fails, try to get text
          try {
            const errorText = await res.text()
            errorMessage = errorText || errorMessage
          } catch {
            // If both fail, use default message
          }
        }
        throw new Error(errorMessage)
      }

      const result = await res.json()
      return result
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tariff-plan-services", providerId] })
      queryClient.invalidateQueries({ queryKey: ["tariff-plan-services-all", providerId] })
      toast({ title: "Success", description: "Service added successfully" })
      setShowAddForm(false)
      resetForm()
    },
    onError: (error) => {
      // Extract specific error message
      const errorMessage = error instanceof Error ? error.message : "Failed to add service"
      console.error("Error adding service:", error)
      toast({ title: "Error", description: errorMessage, variant: "destructive" })
    }
  })

  // Edit service mutation - MUST be before early returns
  const editServiceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await fetch(`/api/provider/tariff-plan/services/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update service")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tariff-plan-services", providerId] })
      queryClient.invalidateQueries({ queryKey: ["tariff-plan-services-all", providerId] })
      toast({ title: "Success", description: "Service updated successfully" })
      setShowEditForm(false)
      setEditingService(null)
      resetForm()
    },
    onError: (error) => {
      // Extract specific error message
      const errorMessage = error instanceof Error ? error.message : "Failed to update service"
      toast({ title: "Error", description: errorMessage, variant: "destructive" })
    }
  })

  // Delete service mutation - MUST be before early returns
  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/provider/tariff-plan/services/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete service")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tariff-plan-services", providerId] })
      queryClient.invalidateQueries({ queryKey: ["tariff-plan-services-all", providerId] })
      toast({ title: "Success", description: "Service deleted successfully" })
    },
    onError: (error) => {
      // Extract specific error message
      const errorMessage = error instanceof Error ? error.message : "Failed to delete service"
      toast({ title: "Error", description: errorMessage, variant: "destructive" })
    }
  })

  // Early returns - must be after all hooks but before function declarations
  if (!providerId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 font-semibold">Provider ID Required</p>
              <p className="text-yellow-600 mt-2">
                No provider ID was provided. Please select a provider to continue.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (tariffPlanError || tariffServicesError) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-semibold">Error Loading Tariff Plan</p>
              <p className="text-red-600 mt-2">
                {tariffPlanError?.message || tariffServicesError?.message || "An error occurred while loading the tariff plan. Please try again."}
              </p>
              <Button
                onClick={() => {
                  if (tariffPlanError) refetchTariffPlan()
                  if (tariffServicesError) queryClient.invalidateQueries({ queryKey: ["tariff-plan-services", providerId] })
                }}
                className="mt-4"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoadingTariffPlan || isLoadingTariff) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="ml-4 text-gray-600">Loading tariff plan...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Filter services by category
  const filteredServices = tariffServices.filter(service => {
    const matchesCategory = !selectedCategory || selectedCategory === "all" || service.category_id === selectedCategory
    const matchesSearch = !searchTerm ||
      service.service_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.service_id.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const getStatusBadgeVariant = (status?: string) => {
    if (!status) return "outline"

    const normalized = status.toUpperCase()
    if (normalized === "PENDING_APPROVAL") return "destructive"
    if (normalized === "APPROVED") return "secondary"
    return "outline"
  }

  // Group services by category (for all services, not just filtered)
  const servicesByCategory = allTariffServices.reduce((acc, service) => {
    const categoryId = service.category_id

    if (!acc[categoryId]) {
      acc[categoryId] = []
    }
    acc[categoryId].push(service)
    return acc
  }, {} as Record<string, TariffPlanService[]>)

  // Helper functions
  const resetForm = () => {
    setFormData({
      service_id: "",
      service_name: "",
      category_id: "",
      price: 0,
      is_primary: false,
      is_secondary: false
    })
    setSelectedService(null)
    setServiceSearchTerm("")
    setShowServiceResults(false)
  }

  const handleAddService = () => {
    setShowAddForm(true)
    // Pre-populate category_id if a category filter is selected
    const initialFormData = {
      service_id: "",
      service_name: "",
      category_id: selectedCategory && selectedCategory !== "all" ? selectedCategory : "",
      price: 0,
      is_primary: false,
      is_secondary: false
    }
    setFormData(initialFormData)
    setSelectedService(null)
    setServiceSearchTerm("")
  }

  const handleEditService = (service: TariffPlanService) => {
    setEditingService(service)
    setFormData({
      service_id: service.service_id,
      service_name: service.service_name,
      category_id: service.category_id,
      price: service.price,
      is_primary: service.is_primary,
      is_secondary: service.is_secondary
    })
    setSelectedService({
      service_id: service.service_id,
      service_name: service.service_name,
      service_category: service.category_name
    })
    setServiceSearchTerm(service.service_name)
    setShowServiceResults(false)
    setShowEditForm(true)
  }

  const handleViewService = (service: TariffPlanService) => {
    setViewingService(service)
    setShowViewModal(true)
  }

  const handleSubmitForm = () => {
    try {
      // Ensure category_id is set - use selectedCategory if not set in formData
      const categoryId = formData.category_id || (selectedCategory && selectedCategory !== "all" ? selectedCategory : "")

      if (!formData.service_id || !formData.service_name || !categoryId || formData.price <= 0) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields (Service, Category, and Price greater than 0)",
          variant: "destructive",
        })
        return
      }

      if (formData.price < 0) {
        toast({
          title: "Invalid Price",
          description: "Price cannot be negative",
          variant: "destructive",
        })
        return
      }

      // Check for duplicate service when adding (not when editing)
      if (showAddForm) {
        // Check both allTariffServices and tariffServices to be safe
        const serviceExists = allTariffServices.some(
          tariffService => tariffService.service_id === formData.service_id
        ) || tariffServices.some(
          tariffService => tariffService.service_id === formData.service_id
        )

        if (serviceExists) {
          console.log("Duplicate service detected:", {
            service_id: formData.service_id,
            service_name: formData.service_name,
            allTariffServicesCount: allTariffServices.length,
            tariffServicesCount: tariffServices.length
          })
          toast({
            title: "Service Already Exists",
            description: `Service "${formData.service_name}" (ID: ${formData.service_id}) has already been added to the tariff plan`,
            variant: "destructive",
          })
          return
        }
      }

      // Ensure category_id is included in the data
      const submitData = {
        ...formData,
        category_id: categoryId
      }

      if (showAddForm) {
        addServiceMutation.mutate(submitData)
      } else if (showEditForm && editingService) {
        editServiceMutation.mutate({ id: editingService.id, data: submitData })
      }
    } catch (error) {
      console.error("Form submission error:", error)
      toast({
        title: "Submission Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleBulkUploadSuccess = (data: any[], processedCount?: number) => {
    toast({
      title: "Success",
      description: `Successfully uploaded ${processedCount || data.length} tariff plan services`,
    })
    queryClient.invalidateQueries({ queryKey: ["tariff-plan-services", providerId] })
    queryClient.invalidateQueries({ queryKey: ["tariff-plan-services-all", providerId] })
  }

  const exportServices = async (categoryId?: string) => {
    // Use provided categoryId or fall back to selectedCategory
    const exportCategory = categoryId || selectedCategory

    // If a category is selected, export ALL services from that category for pricing input
    // Otherwise, export only services already in the tariff plan
    let servicesToExport: any[] = []
    let categoryName = "All"

    if (exportCategory && exportCategory !== "all") {
      // Get category name
      const category = planCategories.find(c => c.id === exportCategory)
      categoryName = category?.name || exportCategory

      try {
        // Fetch ALL services from this category - use category name and high limit
        // Also set page=1 to ensure we start from the beginning
        const params = new URLSearchParams({
          category: exportCategory, // API will convert ID to name
          limit: "50000", // Very high limit to get all services
          page: "1" // Start from first page
        })

        const res = await fetch(`/api/settings/service-types?${params}`)
        if (!res.ok) throw new Error("Failed to fetch all services for category")

        const data = await res.json()
        const categoryServices = data.serviceTypes || []
        const totalCount = data.totalCount || 0

        // Log for debugging
        console.log(`Export: Found ${categoryServices.length} services (total: ${totalCount}) for category ${categoryName} (ID: ${exportCategory})`)

        // If we got fewer services than total, there might be more pages
        // For now, we'll use what we got, but log a warning
        if (totalCount > categoryServices.length) {
          console.warn(`Export: Only fetched ${categoryServices.length} of ${totalCount} services. Consider implementing pagination.`)
        }

        // Map services and include existing prices if service is already in tariff plan
        servicesToExport = categoryServices.map((service: any) => {
          const existingService = allTariffServices.find(
            tariffService => tariffService.service_id === service.service_id
          )

          return {
            service_id: service.service_id,
            service_name: service.service_name,
            category_id: exportCategory,
            category_name: categoryName,
            price: existingService?.price || 0,
            is_primary: existingService?.is_primary || false,
            is_secondary: existingService?.is_secondary || false,
            status: existingService?.status || 'NOT_ADDED'
          }
        })
      } catch (error) {
        console.error("Error fetching services for export:", error)
        toast({
          title: "Export Failed",
          description: "Failed to fetch all services for the selected category",
          variant: "destructive",
        })
        return
      }
    } else {
      // Export only services already in tariff plan (filtered)
      servicesToExport = filteredServices
    }

    if (servicesToExport.length === 0) {
      toast({
        title: "No Services to Export",
        description: exportCategory && exportCategory !== "all"
          ? `No services found in ${categoryName} category`
          : "No services found in tariff plan",
        variant: "destructive",
      })
      return
    }

    const csvContent = [
      ['Service ID', 'Service Name', 'Category', 'Price', 'Primary', 'Secondary', 'Status'].join(','),
      ...servicesToExport.map(service => [
        service.service_id,
        `"${service.service_name}"`,
        service.category_name || categoryName,
        service.price || 0,
        service.is_primary ? 'Yes' : 'No',
        service.is_secondary ? 'Yes' : 'No',
        service.status || 'ACTIVE'
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // Include category name in filename if a category is selected
    const filename = exportCategory && exportCategory !== "all"
      ? `tariff-plan-services-${categoryName.replace(/\s+/g, '-')}-for-pricing.csv`
      : 'tariff-plan-services-all.csv'
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)

    toast({
      title: "Export Successful",
      description: exportCategory && exportCategory !== "all"
        ? `Exported ${servicesToExport.length} service(s) from ${categoryName} category for pricing input`
        : `Exported ${servicesToExport.length} service(s) from tariff plan`,
    })
  }

  const exportServiceTypes = async () => {
    try {
      const res = await fetch('/api/provider/tariff-plan/export-service-types?format=xlsx')
      if (!res.ok) throw new Error('Failed to export service types')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `service-types-template-${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
      toast({
        title: "Success",
        description: "Service types template exported successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export service types template",
        variant: "destructive",
      })
    }
  }

  const handleSaveDraft = async () => {
    if (!tariffPlan) {
      toast({
        title: "Error",
        description: "Tariff plan not found. Please create a tariff plan first.",
        variant: "destructive",
      })
      return
    }

    if (!tariffPlan.id || tariffPlan.id === "null" || tariffPlan.id === "undefined") {
      // If tariff plan doesn't exist, create it first
      try {
        const createRes = await fetch("/api/provider/tariff-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider_id: providerId }),
        })

        if (!createRes.ok) {
          const errorData = await createRes.json()
          throw new Error(errorData.error || "Failed to create tariff plan")
        }

        // Refetch the tariff plan to get the new ID
        await refetchTariffPlan()

        toast({
          title: "Info",
          description: "Tariff plan created. Please try saving again.",
        })
        return
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to create tariff plan. Please refresh the page and try again.",
          variant: "destructive",
        })
        return
      }
    }

    setIsSavingDraft(true)
    try {
      // Get all service IDs from current tariff plan services
      const serviceIds = allTariffServices.map(s => s.id)

      const res = await fetch(`/api/provider/tariff-plan/${tariffPlan.id}/save-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services: serviceIds }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to save draft")
      }

      await refetchTariffPlan()
      toast({
        title: "Success",
        description: "Tariff plan saved as draft successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save draft",
        variant: "destructive",
      })
    } finally {
      setIsSavingDraft(false)
    }
  }

  const handleSaveInProgress = async () => {
    if (!tariffPlan) {
      toast({
        title: "Error",
        description: "Tariff plan not found. Please create a tariff plan first.",
        variant: "destructive",
      })
      return
    }

    if (!tariffPlan.id || tariffPlan.id === "null" || tariffPlan.id === "undefined") {
      try {
        const createRes = await fetch("/api/provider/tariff-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider_id: providerId }),
        })

        if (!createRes.ok) {
          const errorData = await createRes.json()
          throw new Error(errorData.error || "Failed to create tariff plan")
        }

        await refetchTariffPlan()
        toast({
          title: "Info",
          description: "Tariff plan created. Please try saving again.",
        })
        return
      } catch (error) {
        toast({
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "Failed to create tariff plan. Please refresh the page and try again.",
          variant: "destructive",
        })
        return
      }
    }

    setIsSavingInProgress(true)
    try {
      const serviceIds = allTariffServices.map((s) => s.id)

      const res = await fetch(`/api/provider/tariff-plan/${tariffPlan.id}/save-in-progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services: serviceIds }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to mark plan as in-progress")
      }

      await refetchTariffPlan()
      toast({
        title: "Success",
        description: "Tariff plan marked as in-progress",
      })
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to mark plan as in-progress",
        variant: "destructive",
      })
    } finally {
      setIsSavingInProgress(false)
    }
  }

  const handleSubmit = async () => {
    if (!tariffPlan) {
      toast({
        title: "Error",
        description: "Tariff plan not found. Please create a tariff plan first.",
        variant: "destructive",
      })
      return
    }

    if (!tariffPlan.id || tariffPlan.id === "null" || tariffPlan.id === "undefined") {
      // If tariff plan doesn't exist, create it first
      try {
        const createRes = await fetch("/api/provider/tariff-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider_id: providerId }),
        })

        if (!createRes.ok) {
          const errorData = await createRes.json()
          throw new Error(errorData.error || "Failed to create tariff plan")
        }

        // Refetch the tariff plan to get the new ID
        await refetchTariffPlan()

        toast({
          title: "Info",
          description: "Tariff plan created. Please try submitting again.",
        })
        return
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to create tariff plan. Please refresh the page and try again.",
          variant: "destructive",
        })
        return
      }
    }

    // Validate that there are services with prices
    const servicesWithPrices = allTariffServices.filter(s => s.price > 0)
    if (servicesWithPrices.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one service with a price before submitting",
        variant: "destructive",
      })
      return
    }

    if (!confirm("Are you sure you want to submit this tariff plan for approval? You will not be able to edit it until it is approved or rejected.")) {
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/provider/tariff-plan/${tariffPlan.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to submit tariff plan")
      }

      await refetchTariffPlan()
      toast({
        title: "Success",
        description: "Tariff plan submitted for approval successfully. The Provider Management Team has been notified.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit tariff plan",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-800"
      case "PENDING_APPROVAL":
        return "bg-yellow-100 text-yellow-800"
      case "APPROVED":
        return "bg-green-100 text-green-800"
      case "REJECTED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const canEdit =
    !tariffPlan ||
    ["DRAFT", "REJECTED", "IN_PROGRESS"].includes(tariffPlan?.status || "")
  const canCreateNewVersion = tariffPlan?.status === "APPROVED"

  const handleCreateNewVersion = async () => {
    if (!tariffPlan) {
      toast({
        title: "Error",
        description: "Tariff plan not found",
        variant: "destructive",
      })
      return
    }

    if (!confirm("Create a new version of this approved tariff plan? This will copy all services to a new draft that you can edit and modify.")) {
      return
    }

    setIsCreatingVersion(true)
    try {
      const res = await fetch(`/api/provider/tariff-plan/${tariffPlan.id}/create-new-version`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to create new version")
      }

      const data = await res.json()
      await refetchTariffPlan()
      queryClient.invalidateQueries({ queryKey: ["tariff-plan-services", providerId] })

      toast({
        title: "Success",
        description: data.message || "New version created successfully. You can now edit your tariff plan.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create new version",
        variant: "destructive",
      })
    } finally {
      setIsCreatingVersion(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">Tariff Plan Management</h2>
            {tariffPlan && (
              <Badge className={getStatusBadgeColor(tariffPlan.status)}>
                {tariffPlan.status.replace('_', ' ')}
              </Badge>
            )}
          </div>
          <p className="text-gray-600">Manage service prices and categories for this provider</p>
          {tariffPlan && (
            <div className="mt-2 text-sm text-gray-500">
              {tariffPlan.status === "PENDING_APPROVAL" && tariffPlan.submitted_at && (
                <p>Submitted: {new Date(tariffPlan.submitted_at).toLocaleString()}</p>
              )}
              {tariffPlan.status === "APPROVED" && tariffPlan.approved_at && (
                <p>Approved: {new Date(tariffPlan.approved_at).toLocaleString()}</p>
              )}
              {tariffPlan.status === "REJECTED" && tariffPlan.rejection_reason && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-800">
                  <p className="font-semibold">Rejection Reason:</p>
                  <p>{tariffPlan.rejection_reason}</p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={exportServiceTypes}
            variant="outline"
            title="Export service types template"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Template
          </Button>
          <Button onClick={exportServices} variant="outline" title="Export services (Ctrl+E)">
            <Download className="h-4 w-4 mr-2" />
            Export Services
          </Button>
          {canCreateNewVersion && (
            <Button
              onClick={handleCreateNewVersion}
              className="bg-[#BE1522] hover:bg-[#9B1219]"
              disabled={isCreatingVersion}
              title="Create a new version to modify your approved tariff plan"
            >
              {isCreatingVersion ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Version
                </>
              )}
            </Button>
          )}
          {canEdit && (
            <>
              <Button
                onClick={() => setShowBulkUpload(true)}
                variant="outline"
                disabled={!canEdit}
              >
                <Upload className="h-4 w-4 mr-2" />
                Bulk Upload
              </Button>
              <Button
                onClick={handleAddService}
                variant="outline"
                title="Add new service (Ctrl+N)"
                disabled={showAddForm || showEditForm || !canEdit}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>
              <Button
                onClick={handleSaveDraft}
                variant="outline"
                disabled={isSavingDraft || !canEdit}
              >
                {isSavingDraft ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Save as Draft
                  </>
                )}
              </Button>
              <Button
                onClick={handleSaveInProgress}
                variant="outline"
                disabled={isSavingInProgress || !canEdit}
              >
                {isSavingInProgress ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Save In Progress
                  </>
                )}
              </Button>
              <Button
                onClick={handleSubmit}
                className="bg-green-600 hover:bg-green-700"
                disabled={isSubmitting || !canEdit}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>


      {planSettingsData && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs uppercase">
                Plan Status
              </Badge>
              <span className="font-semibold">{planSettingsData.status}</span>
            </CardTitle>
            <CardDescription>
              Limits defined for this plan are listed below. Save Draft / In-Progress as you go.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase text-gray-500">Plan</span>
                <p className="text-sm text-gray-900">{planSettingsData.plan_id} · {planSettingsData.plan_type}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase text-gray-500">Premium</span>
                <p className="text-sm text-gray-900">₦{planSettingsData.premium_amount.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase text-gray-500">Annual Limit</span>
                <p className="text-sm text-gray-900">₦{planSettingsData.annual_limit.toLocaleString()}</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Status</Label>
                <div className="flex items-center gap-2">
                  <StatusIndicator status={planSettingsData.status.toLowerCase()} />
                  <span className="text-xs uppercase text-gray-600">{planSettingsData.status}</span>
                </div>
              </div>
              <div>
                <Label>Limit Type</Label>
                <Select
                  value={limitForm.limit_type}
                  onValueChange={(value) => setLimitForm(prev => ({ ...prev, limit_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {planLimitTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                {limitForm.limit_type.startsWith("CATEGORY") ? (
                  <>
                    <Label>Category</Label>
                    <Select
                      value={limitForm.category_id}
                      onValueChange={(value) => setLimitForm(prev => ({ ...prev, category_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {planCategories.map(category => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <>
                    <Label>Service ID</Label>
                    <Input
                      value={limitForm.service_id}
                      onChange={(e) => setLimitForm(prev => ({ ...prev, service_id: e.target.value }))}
                      placeholder="Enter service ID"
                    />
                  </>
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Price Limit (Optional)</Label>
                <Input
                  value={limitForm.price_limit}
                  type="number"
                  onChange={(e) => setLimitForm(prev => ({ ...prev, price_limit: e.target.value }))}
                  placeholder="e.g., 5000"
                />
              </div>
              <div>
                <Label>Frequency Limit (Optional)</Label>
                <Input
                  value={limitForm.frequency_limit}
                  type="number"
                  onChange={(e) => setLimitForm(prev => ({ ...prev, frequency_limit: e.target.value }))}
                  placeholder="times per year"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleLimitSubmit}
                variant="outline"
                disabled={planLimitMutation.isPending}
              >
                {planLimitMutation.isPending ? "Saving..." : "Save Limit"}
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Category Limits</p>
                {categoryLimits.length === 0 ? (
                  <p className="text-sm text-gray-500">No category limits defined yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {categoryLimits.map(limit => (
                      <li key={limit.id} className="flex items-center justify-between text-sm text-gray-700">
                        <span>{limit.category_name || limit.category_id}</span>
                        <span>
                          {limit.price_limit ? `₦${limit.price_limit.toLocaleString()}` : ""}
                          {limit.frequency_limit ? ` / ${limit.frequency_limit}x` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Service Limits</p>
                {serviceLimits.length === 0 ? (
                  <p className="text-sm text-gray-500">No service limits defined yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {serviceLimits.map(limit => (
                      <li key={limit.id} className="flex items-center justify-between text-sm text-gray-700">
                        <span>{limit.service_id}</span>
                        <span>
                          {limit.price_limit ? `₦${limit.price_limit.toLocaleString()}` : ""}
                          {limit.frequency_limit ? ` / ${limit.frequency_limit}x` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-blue-600" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Services</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="search"
                  placeholder="Search by service name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={selectedCategory}
                onValueChange={(value) => {
                  // Save current scroll position before changing category
                  scrollPositionRef.current = window.scrollY || document.documentElement.scrollTop
                  setSelectedCategory(value)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                  <SelectItem value="all">All categories</SelectItem>
                  {planCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Actions</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (searchTerm || selectedCategory !== "all") {
                      if (confirm("Are you sure you want to clear all filters?")) {
                        setSearchTerm("")
                        setSelectedCategory("all")
                      }
                    }
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Services from Service Type Settings */}
      {selectedCategory && selectedCategory !== "all" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-green-600" />
              Available Services from Service Type Settings
            </CardTitle>
            <CardDescription>
              Services available in {planCategories.find(c => c.id === selectedCategory)?.name} category that can be added to your tariff plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {serviceTypes
                .filter(service => {
                  // Get the category name from planCategories
                  const category = planCategories.find(c => c.id === selectedCategory)
                  const categoryName = category?.name || selectedCategory

                  // Check if the service category matches the selected category name
                  return service.service_category === categoryName
                })
                .map((service) => (
                  <div key={service.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {service.service_type || 'GENERAL'}
                      </Badge>
                      <span className="text-sm font-medium">{service.service_name}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canEdit || allTariffServices.some(tariffService => tariffService.service_id === service.service_id) || addServiceMutation.isPending}
                      onClick={() => {
                        // Check if service already exists in tariff plan (check all services, not just filtered)
                        const serviceExists = allTariffServices.some(tariffService => tariffService.service_id === service.service_id)
                        if (serviceExists) {
                          toast({
                            title: "Service Already Exists",
                            description: "This service has already been added to the tariff plan",
                            variant: "destructive"
                          })
                          return
                        }

                        setSelectedService(service)

                        // Map service category name to category ID using planCategories
                        // Prioritize selectedCategory if available, otherwise try to find match
                        let categoryId = selectedCategory && selectedCategory !== "all" ? selectedCategory : null
                        if (!categoryId) {
                          const category = planCategories.find(c => c.name === service.service_category)
                          categoryId = category?.id || service.service_category
                        }

                        setFormData({
                          service_id: service.service_id,
                          service_name: service.service_name,
                          category_id: categoryId,
                          price: 0,
                          is_primary: false,
                          is_secondary: false
                        })
                        setServiceSearchTerm(service.service_name)
                        setShowAddForm(true)
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {allTariffServices.some(tariffService => tariffService.service_id === service.service_id) ? "Already Added" : addServiceMutation.isPending ? "Adding..." : "Add to Tariff"}
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Tariff Plan Categories
          </CardTitle>
          <CardDescription>
            Select a category to manage service pricing for this provider
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {planCategories.map((category) => {
              const categoryServices = servicesByCategory[category.id] || []
              const primaryServices = categoryServices.filter(s => s.is_primary).length
              const secondaryServices = categoryServices.filter(s => s.is_secondary).length
              const totalServices = categoryServices.length
              const isSelected = selectedCategory === category.id

              return (
                <div key={category.id} className="space-y-4">
                  <div
                    className={`p-6 rounded-lg border-2 cursor-pointer transition-all duration-200 ${isSelected
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      }`}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      // Save current scroll position before changing category
                      scrollPositionRef.current = window.scrollY || document.documentElement.scrollTop
                      setSelectedCategory(
                        isSelected ? "all" : category.id
                      )
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {category.id}
                          </Badge>
                          <h3 className="font-semibold text-lg">{category.name}</h3>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            {totalServices} Services
                          </span>
                          <span className="flex items-center gap-1">
                            <Badge variant="secondary" className="text-xs">Primary</Badge>
                            {primaryServices}
                          </span>
                          <span className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">Secondary</Badge>
                            {secondaryServices}
                          </span>
                          {categoryServices.length > 0 && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4" />
                              Avg: ₦{Math.round(categoryServices.reduce((sum, s) => sum + s.price, 0) / categoryServices.length).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <Badge className="bg-[#BE1522] text-white">
                            Selected
                          </Badge>
                        )}
                        <ChevronRight className={`h-5 w-5 text-gray-400 transition-transform ${isSelected ? 'rotate-90' : ''
                          }`} />
                      </div>
                    </div>
                  </div>

                  {/* Services Table for Selected Category */}
                  {isSelected && (
                    <Card className="ml-4 border-l-4 border-l-blue-500">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <FileText className="h-5 w-5 text-blue-600" />
                              {category.name} Services
                              <Badge variant="secondary">
                                {categoryServices.length} services
                              </Badge>
                            </CardTitle>
                            <CardDescription>
                              Manage pricing for services in this category
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                // Export only services from this category
                                exportServices(category.id)
                              }}
                              title="Export services from this category for pricing"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Export Category
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setShowBulkUpload(true)
                              }}
                              disabled={!canEdit}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Bulk Upload
                            </Button>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAddService()
                              }}
                              size="sm"
                              className="bg-[#BE1522] hover:bg-[#9B1219]"
                              disabled={!canEdit}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Service
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {categoryServices.length > 0 ? (
                          <div className="space-y-4">
                            {categoryServices.map((service) => (
                              <div key={service.id} className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      {service.service_id}
                                    </Badge>
                                    <span className="font-medium">{service.service_name}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {service.is_primary && (
                                      <Badge variant="default" className="text-xs">Primary</Badge>
                                    )}
                                    {service.is_secondary && (
                                      <Badge variant="secondary" className="text-xs">Secondary</Badge>
                                    )}
                                    {!service.is_primary && !service.is_secondary && (
                                      <Badge variant="outline" className="text-xs">Standard</Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-1 text-lg font-semibold text-green-600">
                                    <span>₦{service.price.toLocaleString()}</span>
                                    {service.status && (
                                      <Badge
                                        variant={getStatusBadgeVariant(service.status)}
                                        className="text-xs uppercase"
                                      >
                                        {service.status.replace(/_/g, " ")}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleViewService(service)}>
                                        <FileText className="h-4 w-4 mr-2" />
                                        View Details
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleEditService(service)}
                                        disabled={!canEdit}
                                      >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          if (confirm("Are you sure you want to delete this service?")) {
                                            deleteServiceMutation.mutate(service.id)
                                          }
                                        }}
                                        className="text-red-600"
                                        disabled={deleteServiceMutation.isPending || !canEdit}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        {deleteServiceMutation.isPending ? "Deleting..." : "Delete"}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <p>No services added to this category yet</p>
                            <p className="text-sm">Click "Add Service" to get started</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>


      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        module="provider"
        submodule="tariff-plan"
        onUploadSuccess={handleBulkUploadSuccess}
        uploadEndpoint="/api/provider/tariff-plan/bulk-upload"
        sampleFileName="tariff-plan-services-sample.xlsx"
        acceptedColumns={["Service Name", "Service Price", "Category ID", "Service Type"]}
        requiredColumns={["Service Name", "Service Price"]}
        providerId={providerId}
      />

      {/* Add Service Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-[500px] max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Add Tariff Plan Service</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>Add a new service to the tariff plan</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="service_search">Service *</Label>
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        id="service_search"
                        placeholder="Search for a service..."
                        value={serviceSearchTerm}
                        onChange={(e) => handleServiceSearch(e.target.value)}
                        className="pl-10 pr-10"
                      />
                      {selectedService && (
                        <button
                          type="button"
                          onClick={handleClearService}
                          className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Service Search Results Dropdown */}
                    {showServiceResults && (
                      <div className="service-search-dropdown absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {isLoadingSearchServices ? (
                          <div className="p-3 text-sm text-gray-500">Loading services...</div>
                        ) : searchServices.length === 0 ? (
                          <div className="p-3 text-sm text-gray-500">
                            No services found for "{debouncedServiceSearch}"
                          </div>
                        ) : (
                          searchServices.map((service: any) => (
                            <div
                              key={service.id}
                              onClick={() => handleSelectService(service)}
                              className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium text-gray-900">{service.service_name}</div>
                              <div className="text-sm text-gray-500">{service.service_category}</div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {selectedService && (
                    <div className="p-2 bg-blue-50 rounded-md">
                      <div className="text-sm font-medium text-blue-900">Selected: {selectedService.service_name}</div>
                      <div className="text-xs text-blue-600">ID: {selectedService.service_id} | Category: {selectedService.service_category}</div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price *</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_primary"
                      checked={formData.is_primary}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_primary: checked as boolean }))}
                    />
                    <Label htmlFor="is_primary">Primary Service</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_secondary"
                      checked={formData.is_secondary}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_secondary: checked as boolean }))}
                    />
                    <Label htmlFor="is_secondary">Secondary Service</Label>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitForm}
                  disabled={addServiceMutation.isPending}
                  className="bg-[#BE1522] hover:bg-[#9B1219]"
                >
                  {addServiceMutation.isPending ? "Adding..." : "Add Service"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Service Modal */}
      {showEditForm && editingService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-[500px] max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Edit Tariff Plan Service</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowEditForm(false)
                    setEditingService(null)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>Update the service details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_service_search">Service *</Label>
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        id="edit_service_search"
                        placeholder="Search for a service..."
                        value={serviceSearchTerm}
                        onChange={(e) => handleServiceSearch(e.target.value)}
                        className="pl-10 pr-10"
                      />
                      {selectedService && (
                        <button
                          type="button"
                          onClick={handleClearService}
                          className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Service Search Results Dropdown */}
                    {showServiceResults && (
                      <div className="service-search-dropdown absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {isLoadingSearchServices ? (
                          <div className="p-3 text-sm text-gray-500">Loading services...</div>
                        ) : searchServices.length === 0 ? (
                          <div className="p-3 text-sm text-gray-500">
                            No services found for "{debouncedServiceSearch}"
                          </div>
                        ) : (
                          searchServices.map((service: any) => (
                            <div
                              key={service.id}
                              onClick={() => handleSelectService(service)}
                              className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium text-gray-900">{service.service_name}</div>
                              <div className="text-sm text-gray-500">{service.service_category}</div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {selectedService && (
                    <div className="p-2 bg-blue-50 rounded-md">
                      <div className="text-sm font-medium text-blue-900">Selected: {selectedService.service_name}</div>
                      <div className="text-xs text-blue-600">ID: {selectedService.service_id} | Category: {selectedService.service_category}</div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_price">Price *</Label>
                  <Input
                    id="edit_price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit_is_primary"
                      checked={formData.is_primary}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_primary: checked as boolean }))}
                    />
                    <Label htmlFor="edit_is_primary">Primary Service</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit_is_secondary"
                      checked={formData.is_secondary}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_secondary: checked as boolean }))}
                    />
                    <Label htmlFor="edit_is_secondary">Secondary Service</Label>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => {
                  setShowEditForm(false)
                  setEditingService(null)
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitForm}
                  disabled={editServiceMutation.isPending}
                  className="bg-[#BE1522] hover:bg-[#9B1219]"
                >
                  {editServiceMutation.isPending ? "Updating..." : "Update Service"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View Service Details Modal */}
      {showViewModal && viewingService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-[500px] max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-600">Service Details</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowViewModal(false)
                    setViewingService(null)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>View detailed information about this tariff plan service</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Service ID</Label>
                    <p className="text-lg font-mono">{viewingService.service_id}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Service Name</Label>
                    <p className="text-lg font-medium">{viewingService.service_name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Category</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{viewingService.category_id}</Badge>
                      <span className="text-sm">{viewingService.category_name}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Price</Label>
                    <p className="text-lg font-semibold text-green-600">₦{viewingService.price.toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Service Type</Label>
                    <div className="flex gap-1">
                      {viewingService.is_primary && (
                        <Badge variant="default" className="text-xs">Primary</Badge>
                      )}
                      {viewingService.is_secondary && (
                        <Badge variant="secondary" className="text-xs">Secondary</Badge>
                      )}
                      {!viewingService.is_primary && !viewingService.is_secondary && (
                        <Badge variant="outline" className="text-xs">Standard</Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Status</Label>
                    <Badge
                      variant={viewingService.status === 'ACTIVE' ? 'default' : 'secondary'}
                    >
                      {viewingService.status}
                    </Badge>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <Label className="text-xs font-medium text-gray-400">Created</Label>
                      <p>{new Date(viewingService.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-400">Last Updated</Label>
                      <p>{new Date(viewingService.updated_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => {
                  setShowViewModal(false)
                  setViewingService(null)
                }}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setShowViewModal(false)
                    handleEditService(viewingService)
                  }}
                  className="bg-[#BE1522] hover:bg-[#9B1219]"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Service
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
