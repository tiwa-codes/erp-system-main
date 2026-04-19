"use client"

import { useState, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, Send, Loader2, Search, XCircle, Clock, Calendar } from "lucide-react"
import { useRouter } from "next/navigation"
import { PermissionGate } from "@/components/ui/permission-gate"
import { useSession } from "next-auth/react"

export default function RequestApprovalCodePage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: session } = useSession()

  const [showForm, setShowForm] = useState(true)

  // Tariff type state - PRIVATE or NHIA
  const [tariffType, setTariffType] = useState<'PRIVATE' | 'NHIA'>('PRIVATE')

  // Fetch user profile for provider information
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile")
      if (!res.ok) throw new Error("Failed to fetch profile")
      return res.json()
    }
  })

  const [formData, setFormData] = useState({
    provider_id: "",
    enrollee_id: "",
    hospital: "",
    services: "",
    amount: "",
    diagnosis: "",
    encounter_code: "",
    custom_diagnosis: ""
  })

  // Service selection state
  const [selectedServices, setSelectedServices] = useState<Array<{
    id: string
    name: string
    amount: number
    negotiated_price?: number // For zero-price services (price = 0)
    is_negotiable?: boolean // Flag for zero-price services
    quantity?: number // Quantity for drug services
    unitPrice?: number // Unit price for drug services (to calculate total)
    category_id?: string // Service category ID (e.g., 'DRG' for drugs)
    service_category?: string // Service category to detect drugs
    service_type?: number | null // 1 = Primary, NULL = Secondary
    coverage: 'COVERED' | 'NOT_COVERED'
  }>>([])

  // Price input modal state for zero-price services
  const [showPriceModal, setShowPriceModal] = useState(false)
  const [pendingService, setPendingService] = useState<any>(null)
  const [negotiatedPrice, setNegotiatedPrice] = useState<string>("")


  // ICD-10 diagnosis state
  const [diagnosisSearchTerm, setDiagnosisSearchTerm] = useState("")
  const [debouncedDiagnosisSearch, setDebouncedDiagnosisSearch] = useState("")
  const [showDiagnosisResults, setShowDiagnosisResults] = useState(false)
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<any>(null)
  const [useCustomDiagnosis, setUseCustomDiagnosis] = useState(false)

  // Enrollee verification state
  const [isEnrolleeVerified, setIsEnrolleeVerified] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

  // Search states
  const [enrolleeSearchTerm, setEnrolleeSearchTerm] = useState("")
  const [debouncedEnrolleeSearch, setDebouncedEnrolleeSearch] = useState("")
  const [selectedEnrollee, setSelectedEnrollee] = useState<any>(null)
  const [showEnrolleeResults, setShowEnrolleeResults] = useState(false)

  // Hospital search states
  const [hospitalSearchTerm, setHospitalSearchTerm] = useState("")

  // Auto-populate hospital name and provider_id for provider users
  useEffect(() => {
    console.log('[Provider Auto-populate] Checking:', {
      role: session?.user?.role,
      provider_id: userProfile?.provider_id,
      provider_name: userProfile?.provider_name,
      userProfile
    })

    if (session?.user?.role === 'PROVIDER' && userProfile?.provider_id && userProfile?.provider_name) {
      console.log('[Provider Auto-populate] Setting provider:', userProfile.provider_name)
      setHospitalSearchTerm(userProfile.provider_name)
      setFormData(prev => ({
        ...prev,
        provider_id: userProfile.provider_id,
        hospital: userProfile.provider_name
      }))
      setSelectedHospital({
        id: userProfile.provider_id,
        facility_name: userProfile.provider_name
      })
    }
  }, [session?.user?.role, userProfile?.provider_id, userProfile?.provider_name, userProfile])
  const [debouncedHospitalSearch, setDebouncedHospitalSearch] = useState("")
  const [selectedHospital, setSelectedHospital] = useState<any>(null)
  const [showHospitalResults, setShowHospitalResults] = useState(false)

  // Debounce enrollee search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedEnrolleeSearch(enrolleeSearchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [enrolleeSearchTerm])

  // Debounce hospital search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedHospitalSearch(hospitalSearchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [hospitalSearchTerm])

  // Service search states
  const [serviceSearchTerm, setServiceSearchTerm] = useState("")
  const [debouncedServiceSearch, setDebouncedServiceSearch] = useState("")
  const [showServiceResults, setShowServiceResults] = useState(false)

  // Plan details for coverage checking
  const [enrolleePlanDetails, setEnrolleePlanDetails] = useState<any>(null)
  const [availableServices, setAvailableServices] = useState<Array<{
    id: string
    name: string
    amount: number
    service_category?: string
    coverage: 'COVERED' | 'NOT_COVERED'
  }>>([])

  // Debounce service search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedServiceSearch(serviceSearchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [serviceSearchTerm])

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.enrollee-search-container')) {
        setShowEnrolleeResults(false)
      }
      if (!target.closest('.hospital-search-container')) {
        setShowHospitalResults(false)
      }
      if (!target.closest('.service-search-container')) {
        setShowServiceResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch providers for hospital selection
  const { data: providersData } = useQuery({
    queryKey: ["active-providers"],
    queryFn: async () => {
      const res = await fetch("/api/providers/active")
      if (!res.ok) {
        throw new Error("Failed to fetch providers")
      }
      return res.json()
    },
  })

  // Fetch hospitals for search
  const { data: hospitalSearchData } = useQuery({
    queryKey: ["hospitals", debouncedHospitalSearch],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedHospitalSearch) {
        params.append('search', debouncedHospitalSearch)
      }
      const res = await fetch(`/api/providers?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch hospitals")
      }
      return res.json()
    },
    enabled: debouncedHospitalSearch.length > 0,
  })

  // Fetch enrollees for search
  const { data: enrolleesData } = useQuery({
    queryKey: ["enrollees", debouncedEnrolleeSearch],
    queryFn: async () => {
      const searchParam = debouncedEnrolleeSearch ? `?search=${encodeURIComponent(debouncedEnrolleeSearch)}` : ""
      const res = await fetch(`/api/call-centre/enrollees${searchParam}`)
      if (!res.ok) {
        throw new Error("Failed to fetch enrollees")
      }
      return res.json()
    },
    enabled: true // Always enabled to show all enrollees initially
  })

  // Fetch hospitals for search
  const { data: hospitalsData } = useQuery({
    queryKey: ["hospitals", debouncedEnrolleeSearch],
    queryFn: async () => {
      const searchParam = debouncedEnrolleeSearch ? `?search=${encodeURIComponent(debouncedEnrolleeSearch)}` : ""
      const res = await fetch(`/api/providers${searchParam}`)
      if (!res.ok) {
        throw new Error("Failed to fetch hospitals")
      }
      return res.json()
    },
    enabled: true // Always enabled to show all hospitals initially
  })

  // Fetch ICD-10 diagnosis data
  const { data: diagnosisData } = useQuery({
    queryKey: ["diagnosis", debouncedDiagnosisSearch],
    queryFn: async () => {
      if (!debouncedDiagnosisSearch || debouncedDiagnosisSearch.length < 2) {
        return { diagnoses: [] }
      }

      const res = await fetch(`/api/diagnosis/search?q=${encodeURIComponent(debouncedDiagnosisSearch)}`)
      if (!res.ok) {
        throw new Error("Failed to fetch diagnosis")
      }
      return res.json()
    },
    enabled: !!debouncedDiagnosisSearch && debouncedDiagnosisSearch.length >= 2,
  })

  // Fetch ALL services from global pool
  // Fetch services based on tariff type
  const { data: providerServicesData, isLoading: isLoadingServices } = useQuery({
    queryKey: ["services", tariffType, formData.provider_id, debouncedServiceSearch],
    queryFn: async () => {
      const searchParam = debouncedServiceSearch ? `?search=${encodeURIComponent(debouncedServiceSearch)}` : ""

      if (tariffType === 'NHIA') {
        const res = await fetch(`/api/settings/service-types/nhia${searchParam}`)
        if (!res.ok) return { services: [] }
        return res.json()
      } else {
        if (!formData.provider_id) return { services: [] }
        // For private tariff, use the existing provider tariff endpoint
        // Note: The search param format might differ slightly between endpoints, adjusting as needed
        const providerSearchParam = debouncedServiceSearch ? `&search=${encodeURIComponent(debouncedServiceSearch)}` : ""
        const res = await fetch(`/api/provider/${formData.provider_id}/tariff-services?${providerSearchParam}`)
        if (!res.ok) return { services: [] }
        return res.json()
      }
    },
    enabled: tariffType === 'NHIA' || !!formData.provider_id
  })

  // Use provider services directly - no merge needed
  const services = (providerServicesData?.services || []).map((service: any) => ({
    ...service,
    hasProviderTariff: true,
    providerPrice: service.price,
    providerServiceType: service.service_type, // 1 = Primary, null = Secondary
    categoryName: service.category_name,
    amount: service.price // Use provider's price as the amount
  }))

  const servicesError = null

  // Fetch enrollee plan details for coverage checking
  const { data: enrolleePlanData } = useQuery({
    queryKey: ["enrollee-plan", selectedEnrollee?.id],
    queryFn: async () => {
      if (!selectedEnrollee) return null
      const res = await fetch(`/api/underwriting/principals/${selectedEnrollee.id}`)
      if (!res.ok) {
        return null
      }
      return res.json()
    },
    enabled: !!selectedEnrollee && isEnrolleeVerified
  })

  // Validate coverage for all provider services when enrollee is selected
  const { data: coverageData, isLoading: isLoadingCoverage } = useQuery({
    queryKey: ["coverage-validation", selectedEnrollee?.id, formData.provider_id, services.length],
    queryFn: async () => {
      if (!selectedEnrollee?.id || !formData.provider_id || services.length === 0) {
        return { coverage: [], summary: { all_covered: true } }
      }

      const serviceIds = services.map((s: any) => s.service_id)
      const res = await fetch('/api/approval-codes/validate-coverage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollee_id: selectedEnrollee.id,
          provider_id: formData.provider_id,
          service_ids: serviceIds
        })
      })

      if (!res.ok) {
        console.error('Coverage validation failed')
        return { coverage: [], summary: { all_covered: false } }
      }

      return res.json()
    },
    enabled: !!selectedEnrollee && isEnrolleeVerified && !!formData.provider_id && services.length > 0
  })

  // Merge coverage data with services
  const servicesWithCoverage = services.map((service: any) => {
    const coverage = coverageData?.coverage?.find((c: any) => c.service_id === service.service_id)
    return {
      ...service,
      coverage: coverage?.coverage || 'UNKNOWN',
      coverageReason: coverage?.reason,
      priceLimit: coverage?.price_limit,
      frequencyLimit: coverage?.frequency_limit
    }
  })

  const providers = providersData?.providers || []
  const enrollees = enrolleesData?.enrollees || []
  const hospitals = hospitalsData?.providers || []

  // Combined search results for enrollees and hospitals
  const combinedSearchResults = [
    ...enrollees.map((enrollee: any) => ({
      ...enrollee,
      type: 'enrollee',
      displayName: enrollee.name,
      subtitle: `ID: ${enrollee.enrollee_id} | Phone: ${enrollee.phone_number}`,
      details: `Plan: ${enrollee.plan} | Region: ${enrollee.region}`
    })),
    ...hospitals.map((hospital: any) => ({
      ...hospital,
      type: 'hospital',
      displayName: hospital.facility_name,
      subtitle: `Type: ${hospital.facility_type} | Location: ${hospital.location}`,
      details: `Status: ${hospital.status}`
    }))
  ]

  const requestApprovalMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/call-centre/provider-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to submit request")
      }

      return res.json()
    },
    onSuccess: (data) => {
      // Handle different response types based on service mix
      if (data.approval_code && data.provider_request) {
        // Mixed: Both Primary (auto-approved) and Secondary (sent to Call Centre)
        toast({
          title: "Request Processed",
          description: (
            <div className="space-y-2">
              <p className="font-semibold">{data.message}</p>
              <p className="text-sm">Primary Services Approval Code: <span className="font-mono">{data.approval_code.code}</span></p>
              <p className="text-sm">Secondary Services Request ID: <span className="font-mono">{data.provider_request.request_id}</span></p>
            </div>
          ),
        })
      } else if (data.approval_code) {
        // All Primary services - auto-approved
        toast({
          title: "Auto-Approved!",
          description: (
            <div className="space-y-1">
              <p>{data.message}</p>
              <p className="text-sm">Approval Code: <span className="font-mono font-semibold">{data.approval_code.code}</span></p>
            </div>
          ),
        })
      } else if (data.provider_request) {
        // All Secondary services - sent to Call Centre
        toast({
          title: "Request Submitted",
          description: (
            <div className="space-y-1">
              <p>{data.message}</p>
              <p className="text-sm">Request ID: <span className="font-mono">{data.provider_request.request_id}</span></p>
            </div>
          ),
        })
      }

      router.push("/providers/approval-codes")
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const sendEncounterCodeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEnrollee?.enrollee_id) {
        throw new Error("Please select an enrollee before sending encounter code")
      }

      const res = await fetch('/api/call-centre/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollee_id: selectedEnrollee.enrollee_id,
          enrollee_name: selectedEnrollee.displayName || selectedEnrollee.name
        })
      })

      const result = await res.json()
      if (!res.ok) {
        throw new Error(result?.error || "Failed to send encounter code")
      }

      return result
    },
    onSuccess: (result) => {
      const generatedCode = result?.approval_code || ""
      if (generatedCode) {
        handleInputChange("encounter_code", generatedCode)
      }

      toast({
        title: "Encounter Code Sent",
        description: generatedCode
          ? `Encounter code ${generatedCode} has been generated and sent to enrollee`
          : "Encounter code has been generated and sent to enrollee",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Send Encounter Code",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))

    // Reset verification when encounter code changes
    if (field === 'encounter_code') {
      setIsEnrolleeVerified(false)
      setIsVerifying(false)
    }
  }

  const handleProviderChange = (providerId: string) => {
    const selectedProvider = providers.find((provider: any) => provider.id === providerId)
    if (selectedProvider) {
      setFormData(prev => ({
        ...prev,
        provider_id: selectedProvider.id,
        hospital: selectedProvider.facility_name
      }))
    }
  }

  const handleEnrolleeSearch = (value: string) => {
    setEnrolleeSearchTerm(value)
    setShowEnrolleeResults(true) // Always show results when typing
  }

  const handleHospitalSearch = (value: string) => {
    setHospitalSearchTerm(value)
    setShowHospitalResults(true) // Always show results when typing
  }

  const handleSelectEnrollee = (item: any) => {
    if (item.type === 'enrollee') {
      setSelectedEnrollee(item)
      setFormData(prev => ({
        ...prev,
        enrollee_id: item.id
      }))
      setEnrolleeSearchTerm(item.displayName)
    } else if (item.type === 'hospital') {
      // Handle hospital selection if needed
      handleProviderChange(item.id)
      setEnrolleeSearchTerm(item.displayName)
    }
    setShowEnrolleeResults(false)

    // Reset verification when enrollee changes
    setIsEnrolleeVerified(false)
    setIsVerifying(false)
  }

  const handleSelectHospital = (hospital: any) => {
    setSelectedHospital(hospital)
    setFormData(prev => ({
      ...prev,
      provider_id: hospital.id,
      hospital: hospital.facility_name
    }))
    setHospitalSearchTerm(hospital.facility_name)
    setShowHospitalResults(false)
  }

  const handleClearEnrollee = () => {
    setSelectedEnrollee(null)
    setEnrolleeSearchTerm("")
    setFormData(prev => ({
      ...prev,
      enrollee_id: ""
    }))
    setShowEnrolleeResults(false)
  }

  const handleClearHospital = () => {
    setSelectedHospital(null)
    setHospitalSearchTerm("")
    setFormData(prev => ({
      ...prev,
      provider_id: "",
      hospital: ""
    }))
    setShowHospitalResults(false)
  }

  // Diagnosis search handlers
  const handleDiagnosisSearch = (value: string) => {
    setDiagnosisSearchTerm(value)
    setShowDiagnosisResults(value.length >= 2)
    setUseCustomDiagnosis(false)
  }

  const handleSelectDiagnosis = (diagnosis: any) => {
    setSelectedDiagnosis(diagnosis)
    setFormData(prev => ({
      ...prev,
      diagnosis: diagnosis.code + ' - ' + diagnosis.description
    }))
    setDiagnosisSearchTerm(diagnosis.code + ' - ' + diagnosis.description)
    setShowDiagnosisResults(false)
  }

  const handleClearDiagnosis = () => {
    setSelectedDiagnosis(null)
    setDiagnosisSearchTerm("")
    setFormData(prev => ({
      ...prev,
      diagnosis: ""
    }))
    setShowDiagnosisResults(false)
    setUseCustomDiagnosis(false)
  }

  const handleUseCustomDiagnosis = () => {
    setUseCustomDiagnosis(true)
    setSelectedDiagnosis(null)
    setDiagnosisSearchTerm("")
    setFormData(prev => ({
      ...prev,
      diagnosis: ""
    }))
    setShowDiagnosisResults(false)
  }

  // Enrollee verification handler
  const handleVerifyEnrollee = async () => {
    if (!formData.encounter_code) {
      toast({
        title: "Error",
        description: "Please enter encounter code to verify enrollee",
        variant: "destructive",
      })
      return
    }

    if (formData.encounter_code.length !== 4) {
      toast({
        title: "Invalid Encounter Code",
        description: "Encounter code must be exactly 4 characters",
        variant: "destructive",
      })
      return
    }

    if (!formData.enrollee_id) {
      toast({
        title: "Error",
        description: "Please select an enrollee first",
        variant: "destructive",
      })
      return
    }

    if (!formData.provider_id) {
      toast({
        title: "Error",
        description: "Please select a provider first",
        variant: "destructive",
      })
      return
    }

    setIsVerifying(true)
    setIsEnrolleeVerified(false)

    try {
      const response = await fetch('/api/encounter/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          encounterCode: formData.encounter_code,
          enrolleeId: formData.enrollee_id,
          providerId: formData.provider_id
        })
      })

      const result = await response.json()

      if (result.success) {
        setIsEnrolleeVerified(true)
        toast({
          title: "Enrollee Verified Successfully",
          description: `Encounter code ${result.data.encounterCode} verified for ${result.data.enrollee.first_name} ${result.data.enrollee.last_name}`,
        })
      } else {
        setIsEnrolleeVerified(false)
        toast({
          title: "Verification Failed",
          description: result.error || "Failed to verify encounter code",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Verification error:', error)
      setIsEnrolleeVerified(false)
      toast({
        title: "Verification Error",
        description: "Network error. Please check your connection and try again.",
        variant: "destructive",
      })
    } finally {
      setIsVerifying(false)
    }
  }

  // Service management functions
  const getAvailableServices = () => {
    // Use services with coverage data directly
    return servicesWithCoverage.map((service: any) => ({
      id: service.id,
      name: service.service_name || service.name,
      amount: parseFloat(String(service.price || service.amount || 0)) || 0,
      category_id: service.category_id || '',
      service_category: service.service_category || service.category_name || '',
      service_type: service.service_type || service.providerServiceType,
      coverage: service.coverage, // COVERED, NOT_COVERED, LIMIT_EXCEEDED, UNKNOWN
      coverageReason: service.coverageReason,
      priceLimit: service.priceLimit,
      frequencyLimit: service.frequencyLimit,
      providerServiceType: service.providerServiceType
    }))
  }

  // Filter services based on search term
  const getFilteredServices = () => {
    const allServices = getAvailableServices()

    if (!debouncedServiceSearch) {
      return allServices
    }

    return allServices.filter((service: any) =>
      service.name.toLowerCase().includes(debouncedServiceSearch.toLowerCase())
    )
  }

  const handleServiceSearch = (value: string) => {
    setServiceSearchTerm(value)
    setShowServiceResults(true)
  }

  const handleSelectService = async (service: any) => {
    if (service.coverage === 'NOT_COVERED') {
      toast({
        title: "Service Not Covered",
        description: service.coverageReason || "This service is not covered under the enrollee's plan for this provider",
        variant: "destructive",
      })
      return
    }

    if (service.coverage === 'LIMIT_EXCEEDED') {
      toast({
        title: "Price Limit Exceeded",
        description: service.coverageReason || "This service exceeds the plan's price limit",
        variant: "destructive",
      })
      return
    }

    if (!isEnrolleeVerified) {
      toast({
        title: "Enrollee Not Verified",
        description: "Please verify the enrollee before selecting services",
        variant: "destructive",
      })
      return
    }

    // Check if service has zero price (negotiable service)
    const isNegotiable = service.amount === 0 || service.price === 0

    if (isNegotiable) {
      // Show price input modal for negotiable services
      setPendingService(service)
      setNegotiatedPrice("")
      setShowPriceModal(true)
      return
    }

    // Check package limits for this service
    try {
      const response = await fetch('/api/package-limits/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enrollee_id: selectedEnrollee?.enrollee_id,
          package_type: service.name // Using service name as package type
        })
      })

      const result = await response.json()

      if (result.success && result.hasLimit && result.exceeded) {
        toast({
          title: "Package Limit Exceeded",
          description: `This enrollee has exceeded their ${service.name} package limit. Used: ₦${result.packageLimit.usedAmount.toLocaleString()} of ₦${result.packageLimit.amount.toLocaleString()}`,
          variant: "destructive",
        })
        return
      }
    } catch (error) {
      console.error('Error checking package limit:', error)
      // Continue with service selection if check fails
    }

    toggleService(service.id)
    setServiceSearchTerm("")
    setShowServiceResults(false)
  }

  const toggleService = (serviceId: string) => {
    const service = getAvailableServices().find((s: any) => s.id === serviceId)
    if (!service) return

    if (selectedServices.find(s => s.id === serviceId)) {
      setSelectedServices(prev => prev.filter(s => s.id !== serviceId))
    } else {
      // Add service with default quantity 1 for ALL services
      // This standardizes the flow: Quantity * Unit Price = Total Amount

      const unitPrice = service.amount || 0
      const serviceToAdd = {
        ...service,
        quantity: 1,
        unitPrice: unitPrice,
        amount: unitPrice * 1 // Initial amount
      }

      setSelectedServices(prev => [...prev, serviceToAdd])
    }
  }

  // Update quantity for a drug service
  const updateServiceQuantity = (serviceId: string, quantity: number) => {
    setSelectedServices(prev => prev.map(service => {
      if (service.id === serviceId) {
        return {
          ...service,
          quantity: quantity,
          amount: (service.unitPrice || 0) * quantity
        }
      }
      return service
    }))
  }

  // Handle negotiated price confirmation for zero-price services
  const handleConfirmNegotiatedPrice = () => {
    const price = parseFloat(negotiatedPrice)

    if (!price || price <= 0) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid price greater than 0",
        variant: "destructive",
      })
      return
    }

    if (!pendingService) return

    // Add service with negotiated price
    const serviceToAdd = {
      ...pendingService,
      is_negotiable: true,
      negotiated_price: price,
      amount: price // Use negotiated price as amount
    }

    setSelectedServices(prev => [...prev, serviceToAdd])
    setShowPriceModal(false)
    setPendingService(null)
    setNegotiatedPrice("")
    setServiceSearchTerm("")
    setShowServiceResults(false)

    toast({
      title: "Service Added",
      description: `${pendingService.name} added with negotiated price: ₦${price.toLocaleString()}`,
    })
  }

  // Update negotiated price for already selected service
  const updateNegotiatedPrice = (serviceId: string, price: number) => {
    setSelectedServices(prev => prev.map(service => {
      if (service.id === serviceId && service.is_negotiable) {
        return {
          ...service,
          negotiated_price: price,
          amount: price
        }
      }
      return service
    }))
  }

  const updateFormData = () => {
    const totalAmount = selectedServices.reduce((sum, service) => {
      const serviceAmount = service.amount
      const amount = typeof serviceAmount === 'number' ? serviceAmount : parseFloat(String(serviceAmount)) || 0
      return sum + amount
    }, 0)
    const servicesText = selectedServices.map(s => s.name).join(", ")

    setFormData(prev => ({
      ...prev,
      services: servicesText,
      amount: totalAmount.toString()
    }))
  }

  // Update form data when selected services change
  useEffect(() => {
    updateFormData()
  }, [selectedServices])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.provider_id || !formData.enrollee_id || selectedServices.length === 0 || !isEnrolleeVerified) {
      toast({
        title: "Error",
        description: "Please fill in all required fields, verify enrollee, and select at least one service",
        variant: "destructive",
      })
      return
    }

    if (!formData.diagnosis && !formData.custom_diagnosis) {
      toast({
        title: "Error",
        description: "Please provide a diagnosis",
        variant: "destructive",
      })
      return
    }

    // Prepare services data for API with service_type for Primary/Secondary split
    const servicesData = selectedServices.map(service => ({
      id: service.id,
      service_name: service.name,
      amount: service.amount,
      tariff_price: service.unitPrice || service.amount, // Send original unit price as tariff price
      quantity: service.quantity,
      coverage: service.coverage,
      service_type: service.service_type // 1 = Primary (auto-approve), null = Secondary (Call Centre)
    }))

    const submissionData = {
      ...formData,
      services: servicesData,
      diagnosis: formData.diagnosis || formData.custom_diagnosis,
      tariff_type: tariffType // Include tariff type
    }

    requestApprovalMutation.mutate(submissionData)
  }

  return (
    <PermissionGate module="provider" action="add">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push("/providers/approval-codes")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Request Approval Code</h1>
              <p className="text-muted-foreground">
                Submit a request for approval code to the call center
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{new Date().toLocaleDateString('en-GB')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>

        {/* Form Section */}
        <>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Provider Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Request Approval Code
                </CardTitle>
                <CardDescription>
                  Fill in the details to request an approval code from the call center
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Tariff Type Selection */}
                <div className="space-y-2">
                  <Label htmlFor="tariff_type">Tariff Type *</Label>
                  <Select
                    value={tariffType}
                    onValueChange={(value) => setTariffType(value as 'PRIVATE' | 'NHIA')}
                  >
                    <SelectTrigger id="tariff_type">
                      <SelectValue placeholder="Select Tariff Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRIVATE">Private Tariff</SelectItem>
                      <SelectItem value="NHIA">NHIA Tariff</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    {tariffType === 'PRIVATE'
                      ? 'Using provider-specific tariff prices'
                      : 'Using NHIA standard tariff prices'}
                  </p>
                </div>

                {/* Provider Details */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Provider Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative hospital-search-container">
                      <Label htmlFor="hospital_search">Search Hospital *</Label>
                      <div className="relative">
                        <Input
                          id="hospital_search"
                          placeholder="Search by hospital name..."
                          value={hospitalSearchTerm}
                          onChange={(e) => handleHospitalSearch(e.target.value)}
                          onFocus={() => setShowHospitalResults(true)}
                          disabled={session?.user?.role === 'PROVIDER'}
                          className={session?.user?.role === 'PROVIDER' ? 'bg-gray-100 cursor-not-allowed' : ''}
                        />
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        {selectedHospital && (
                          <button
                            type="button"
                            onClick={handleClearHospital}
                            className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Hospital Search Results Dropdown */}
                      {showHospitalResults && hospitalSearchData?.providers && session?.user?.role !== 'PROVIDER' && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {hospitalSearchData.providers.length === 0 ? (
                            <div className="p-3 text-sm text-gray-500">No hospitals found</div>
                          ) : (
                            hospitalSearchData.providers.map((hospital: any) => (
                              <div
                                key={hospital.id}
                                onClick={() => handleSelectHospital(hospital)}
                                className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium text-gray-900">{hospital.facility_name}</div>
                                    <div className="text-sm text-gray-500">{hospital.hcp_code}</div>
                                  </div>
                                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                                    Hospital
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600 mt-1">
                                  {hospital.address}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hospital">Selected Hospital</Label>
                      <Input
                        id="hospital"
                        value={formData.hospital}
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Enrollee Information */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Enrollee Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative enrollee-search-container">
                      <Label htmlFor="enrollee_search">Search Enrollee *</Label>
                      <div className="relative">
                        <Input
                          id="enrollee_search"
                          placeholder="Search by name, ID, phone number..."
                          value={enrolleeSearchTerm}
                          onChange={(e) => handleEnrolleeSearch(e.target.value)}
                          onFocus={() => setShowEnrolleeResults(true)}
                        />
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        {selectedEnrollee && (
                          <button
                            type="button"
                            onClick={handleClearEnrollee}
                            className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Search Results Dropdown */}
                      {showEnrolleeResults && enrolleesData?.enrollees && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {enrolleesData.enrollees.length > 0 ? (
                            enrolleesData.enrollees.map((enrollee: any) => (
                              <div
                                key={`enrollee - ${enrollee.id} `}
                                className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                onClick={() => handleSelectEnrollee({
                                  ...enrollee,
                                  type: 'enrollee',
                                  displayName: enrollee.name,
                                  subtitle: `ID: ${enrollee.enrollee_id} | Phone: ${enrollee.phone_number} `,
                                  details: `Plan: ${enrollee.plan} | Region: ${enrollee.region} `
                                })}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <div className="font-medium text-gray-900">
                                        {enrollee.name}
                                      </div>
                                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                                        Enrollee
                                      </span>
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">
                                      ID: {enrollee.enrollee_id} | Phone: {enrollee.phone_number}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      Plan: {enrollee.plan} | Region: {enrollee.region}
                                      {enrollee.band_type && ` | Band: ${enrollee.band_type} `}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-gray-500 text-sm">
                              No results found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="enrollee_id">Selected Enrollee ID</Label>
                      <Input
                        id="enrollee_id"
                        value={selectedEnrollee?.enrollee_id || ""}
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Enrollee Verification */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Enrollee Verification</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="encounter_code">Encounter Code *</Label>
                      <Input
                        id="encounter_code"
                        value={formData.encounter_code}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase()
                          if (value.length <= 4) {
                            handleInputChange("encounter_code", value)
                          }
                        }}
                        placeholder="Enter 4-character encounter code"
                        maxLength={4}
                        className={`${formData.encounter_code && formData.encounter_code.length < 4 ? "border-yellow-300" : ""} ${formData.encounter_code.length === 4 ? "bg-gray-50" : ""} `}
                      />
                      {formData.encounter_code && (
                        <div className="flex items-center justify-between text-xs">
                          <div className={`${formData.encounter_code.length < 4 ? "text-yellow-600" : "text-green-600"} `}>
                            {formData.encounter_code.length < 4
                              ? "Encounter code must be 4 characters"
                              : "Encounter code length is valid"
                            }
                          </div>
                          <div className="text-gray-500">
                            {formData.encounter_code.length}/4
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-gray-500">
                        Format: Exactly 4 alphanumeric characters (e.g., AB12)
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => sendEncounterCodeMutation.mutate()}
                        disabled={!selectedEnrollee?.enrollee_id || sendEncounterCodeMutation.isPending}
                        className="w-full"
                      >
                        {sendEncounterCodeMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending Encounter Code...
                          </>
                        ) : (
                          "Send Encounter Code"
                        )}
                      </Button>
                      {!selectedEnrollee?.enrollee_id && (
                        <p className="text-xs text-amber-600">Select an enrollee first to send encounter code</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Verification Status</Label>
                      <div className="flex items-center gap-2">
                        {isVerifying ? (
                          <div className="flex items-center gap-2 text-blue-600">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <span className="text-sm">Verifying...</span>
                          </div>
                        ) : isEnrolleeVerified ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm font-medium">Verified</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-gray-500">
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                            <span className="text-sm">Not Verified</span>
                          </div>
                        )}
                        <Button
                          type="button"
                          onClick={handleVerifyEnrollee}
                          disabled={formData.encounter_code.length !== 4 || isVerifying || isEnrolleeVerified}
                          size="sm"
                          className="ml-auto"
                        >
                          {isVerifying ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            "Verify Enrollee"
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Diagnosis Information */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Diagnosis Information</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="diagnosis">Diagnosis *</Label>
                      {!useCustomDiagnosis ? (
                        <div className="relative diagnosis-search-container">
                          <div className="relative">
                            <Input
                              id="diagnosis"
                              placeholder="Search ICD-10 diagnosis..."
                              value={diagnosisSearchTerm}
                              onChange={(e) => handleDiagnosisSearch(e.target.value)}
                              onFocus={() => setShowDiagnosisResults(diagnosisSearchTerm.length >= 2)}
                            />
                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            {selectedDiagnosis && (
                              <button
                                type="button"
                                onClick={handleClearDiagnosis}
                                className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          {/* ICD-10 Search Results Dropdown */}
                          {showDiagnosisResults && diagnosisData?.diagnoses && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                              {diagnosisData.diagnoses.length > 0 ? (
                                diagnosisData.diagnoses.map((diagnosis: any) => (
                                  <div
                                    key={diagnosis.code}
                                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                    onClick={() => handleSelectDiagnosis(diagnosis)}
                                  >
                                    <div className="font-medium text-gray-900">
                                      {diagnosis.code} - {diagnosis.description}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      Category: {diagnosis.category}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="px-4 py-3 text-gray-500 text-sm">
                                  <div>No diagnosis found</div>
                                  <button
                                    type="button"
                                    onClick={handleUseCustomDiagnosis}
                                    className="text-blue-600 hover:text-blue-700 mt-2"
                                  >
                                    Enter custom diagnosis instead
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleUseCustomDiagnosis}
                            className="mt-2"
                          >
                            Use Custom Diagnosis
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Textarea
                            id="custom_diagnosis"
                            value={formData.custom_diagnosis}
                            onChange={(e) => handleInputChange("custom_diagnosis", e.target.value)}
                            placeholder="Enter custom diagnosis details..."
                            rows={3}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setUseCustomDiagnosis(false)
                              setFormData(prev => ({ ...prev, custom_diagnosis: "" }))
                            }}
                          >
                            Search ICD-10 Instead
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Service Information */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Service Information</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Search and Select Services *</Label>
                      {!formData.provider_id && (
                        <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                          Please select a hospital first to see available services
                        </p>
                      )}
                      {formData.provider_id && !isEnrolleeVerified && (
                        <p className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                          Please verify enrollee with encounter code to enable service selection
                        </p>
                      )}

                      {/* Service Search */}
                      <div className="relative service-search-container">
                        <div className="relative">
                          <Input
                            placeholder={formData.provider_id ? "Search services by name..." : "Select hospital first to search services..."}
                            value={serviceSearchTerm}
                            onChange={(e) => handleServiceSearch(e.target.value)}
                            onFocus={() => setShowServiceResults(true)}
                            disabled={!formData.provider_id || !isEnrolleeVerified}
                          />
                          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        </div>

                        {/* Service Search Results Dropdown */}
                        {showServiceResults && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {isLoadingServices ? (
                              <div className="px-4 py-3 text-gray-500 text-sm">
                                Loading services...
                              </div>
                            ) : servicesError ? (
                              <div className="px-4 py-3 text-red-500 text-sm">
                                Error loading services: {(servicesError as Error)?.message || 'Unknown error'}
                              </div>
                            ) : getFilteredServices().length > 0 ? (
                              getFilteredServices().map((service: any) => (
                                <div
                                  key={service.id}
                                  className={`px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 border-l-4 ${service.coverage === 'COVERED'
                                    ? 'bg-green-50 hover:bg-green-100 border-l-green-500'
                                    : service.coverage === 'LIMIT_EXCEEDED'
                                      ? 'bg-orange-50 hover:bg-orange-100 border-l-orange-500'
                                      : service.coverage === 'NOT_COVERED'
                                        ? 'bg-red-50 hover:bg-red-100 border-l-red-500 opacity-75'
                                        : 'bg-gray-50 hover:bg-gray-100 border-l-gray-500'
                                    }`}
                                  onClick={() => handleSelectService(service)}
                                  title={service.coverageReason || undefined}
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <div className="font-medium text-gray-900">
                                          {service.name}
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${service.coverage === 'COVERED'
                                          ? 'bg-green-600 text-white'
                                          : service.coverage === 'LIMIT_EXCEEDED'
                                            ? 'bg-orange-600 text-white'
                                            : service.coverage === 'NOT_COVERED'
                                              ? 'bg-red-600 text-white'
                                              : 'bg-gray-400 text-white'
                                          }`}>
                                          {service.coverage === 'COVERED'
                                            ? '✓ Covered'
                                            : service.coverage === 'LIMIT_EXCEEDED'
                                              ? '⚠ Limit Exceeded'
                                              : service.coverage === 'NOT_COVERED'
                                                ? '✗ Not Covered'
                                                : 'Unknown'}
                                        </span>
                                        {service.providerServiceType === 1 ? (
                                          <span className="text-xs px-2 py-1 rounded-full bg-blue-600 text-white font-semibold">
                                            Primary
                                          </span>
                                        ) : service.providerServiceType === null ? (
                                          <span className="text-xs px-2 py-1 rounded-full bg-purple-600 text-white font-semibold">
                                            Secondary
                                          </span>
                                        ) : null}
                                      </div>
                                      <div className="text-sm text-gray-600 mt-1 flex items-center gap-3">
                                        <span className="font-semibold text-green-700">
                                          ₦{service.amount?.toLocaleString()}
                                        </span>
                                        {service.priceLimit && (
                                          <span className="text-xs text-orange-600">
                                            Limit: ₦{service.priceLimit.toLocaleString()}
                                          </span>
                                        )}
                                        {service.frequencyLimit && (
                                          <span className="text-xs text-blue-600">
                                            Max: {service.frequencyLimit}x
                                          </span>
                                        )}
                                      </div>
                                      {service.coverageReason && (
                                        <div className="text-xs text-gray-500 mt-1 italic">
                                          {service.coverageReason}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="px-4 py-3 text-gray-500 text-sm">
                                {services.length === 0
                                  ? "No services uploaded for this provider. Please upload services in Provider Management → Tariff Management first."
                                  : debouncedServiceSearch
                                    ? `No services found matching "${debouncedServiceSearch}"`
                                    : "No services found"}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Selected Services Summary */}
                    {selectedServices.length > 0 && (
                      <div className="space-y-2">
                        <Label>Selected Services</Label>
                        <div className="space-y-2">
                          {selectedServices.map((service) => {
                            // Enhanced drug detection
                            const categoryId = (service as any).category_id?.toUpperCase() || ''
                            const categoryLower = service.service_category?.toLowerCase() || ''
                            const nameLower = service.name?.toLowerCase() || ''
                            const isDrug = categoryId === 'DRG' || // Check category ID first (works for manually added services)
                              categoryLower.includes('drug') ||
                              categoryLower.includes('pharmaceutical') ||
                              categoryLower.includes('pharmacy') ||
                              categoryLower.includes('medication') ||
                              categoryLower.includes('medicine') ||
                              categoryLower === 'drg' ||
                              nameLower.includes('tablet') ||
                              nameLower.includes('capsule') ||
                              nameLower.includes('syrup') ||
                              nameLower.includes('injection')

                            return (
                              <div key={service.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                                <div className="flex items-center gap-3 flex-1">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  <div className="flex-1">
                                    <div className="font-medium text-blue-900">{service.name}</div>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <div className="text-sm text-blue-700">
                                        Unit Price: ₦{(service.unitPrice || service.amount).toLocaleString()}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground w-12">Qty:</span>
                                        <Input
                                          type="number"
                                          min="1"
                                          className="h-7 w-20 px-2 py-1 text-right"
                                          value={service.quantity || ""}
                                          onChange={(e) => {
                                            const val = e.target.value
                                            if (val === "") {
                                              // Allow clearing the field
                                              updateServiceQuantity(service.id, 1)
                                            } else {
                                              const numVal = parseInt(val)
                                              if (numVal > 0) {
                                                updateServiceQuantity(service.id, numVal)
                                              }
                                            }
                                          }}
                                          onBlur={(e) => {
                                            // If empty on blur, default to 1
                                            if (e.target.value === "") {
                                              updateServiceQuantity(service.id, 1)
                                            }
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </div>
                                      <div className="text-sm font-semibold text-green-700">
                                        Total: ₦{service.amount.toLocaleString()}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleService(service.id)}
                                  className="text-red-500 hover:text-red-700 ml-2"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="amount">Total Amount</Label>
                      <Input
                        id="amount"
                        value={formData.amount}
                        readOnly
                        className="bg-gray-50 font-semibold text-green-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-4 pt-6">
                  <Button
                    type="submit"
                    disabled={requestApprovalMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {requestApprovalMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Submit Request
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </>
      </div>

      {/* Price Input Modal for Zero-Price Services */}
      <Dialog open={showPriceModal} onOpenChange={setShowPriceModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Negotiated Price</DialogTitle>
            <DialogDescription>
              This service has a negotiable price (₦0 in tariff). Please enter the agreed price for this service.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {pendingService && (
              <div className="bg-blue-50 p-3 rounded-md">
                <p className="font-medium text-blue-900">{pendingService.name}</p>
                <p className="text-sm text-blue-600">Tariff Price: ₦0 (Negotiable)</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="negotiated-price">Negotiated Price (₦)</Label>
              <Input
                id="negotiated-price"
                type="number"
                min="1"
                step="0.01"
                value={negotiatedPrice}
                onChange={(e) => setNegotiatedPrice(e.target.value)}
                placeholder="Enter price"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleConfirmNegotiatedPrice()
                  }
                }}
              />
              <p className="text-xs text-gray-500">
                Enter the price agreed upon for this service
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPriceModal(false)
                setPendingService(null)
                setNegotiatedPrice("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmNegotiatedPrice}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Confirm Price
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PermissionGate>
  )
}
