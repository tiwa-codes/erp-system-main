"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { StatusText } from "@/components/ui/status-text"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  FileText,
  Calendar,
  User,
  Building,
  CreditCard,
  Activity,
  Search,
  Plus,
  Minus,
  AlertCircle,
  Pill,
  Stethoscope,
  History
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { useRouter } from "next/navigation"
import { PreviousEncounterModal } from "@/components/call-centre/PreviousEncounterModal"
import { formatCountdown } from "@/lib/add-service-window"



interface ServiceRequest {
  id: string
  service_name: string
  amount: number
  coverage: 'COVERED' | 'EXCEEDED' | 'NOT_COVERED' | 'REJECTED'
  remarks?: string
  provider_additional_comment?: string | null
  tariff_price?: number
  negotiated_price?: number
  is_negotiable?: boolean
  quantity?: number
  is_approved?: boolean // For eligibility checkbox
  is_added_after_approval?: boolean
  is_primary?: boolean
}

interface ServiceWithCoverage {
  id: string
  service_name: string
  service_category: string
  coverage_status: 'COVERED' | 'NOT_IN_PLAN' | 'NOT_ASSIGNED' | 'LIMIT_EXCEEDED'
  facility_price: number
  limit_count: number
  selectable: boolean
  status_message?: string | null
  category_price_limit?: number | null
  category_frequency_limit?: number | null
  category_used_amount?: number
  category_used_frequency?: number
  category_balance_amount?: number | null
  category_balance_frequency?: number | null
}

interface ApprovalRequest {
  id: string
  request_id: string
  provider_id?: string
  tariff_type?: "PRIVATE" | "NHIA" | string
  enrollee_id: string
  enrollee_name: string
  organization: string
  plan: string
  beneficiary_id?: string | null
  enrollee_gender?: string | null
  enrollee_marital_status?: string | null
  enrollee_plan_name?: string
  enrollee_organization_name?: string
  enrollee_expiration_date?: string | null
  diagnosis: string
  added_services_comment?: string | null
  provider_name: string
  hospital_name: string
  provider_bands?: string[]
  services: ServiceRequest[]
  total_amount: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  date: string
  admission_required: boolean
  is_primary_auto_approved?: boolean
  original_approval_code?: string | null
  is_added_after_approval_request?: boolean
  add_service_expires_at?: string | null
  add_service_window_expired?: boolean
  original_approval_services?: Array<{
    id: string
    service_name: string
    amount: number
    quantity?: number
    is_ad_hoc?: boolean
    coverage?: string | null
    rejection_reason?: string | null
  }>
}

export default function GenerateCodePage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()

  // Get request ID from URL params
  const [requestId, setRequestId] = useState<string>("")
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Service search and selection
  const [serviceSearchTerm, setServiceSearchTerm] = useState("")
  const [drugSearchTerm, setDrugSearchTerm] = useState("")
  const [selectedService, setSelectedService] = useState<any>(null)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [customPrice, setCustomPrice] = useState("")
  const [customQuantity, setCustomQuantity] = useState("1")
  const [adHocServiceName, setAdHocServiceName] = useState("")
  const [adHocServicePrice, setAdHocServicePrice] = useState("")
  const [adHocServiceQuantity, setAdHocServiceQuantity] = useState("1")
  const [showAdHocModal, setShowAdHocModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve')
  const [rejectReason, setRejectReason] = useState("")
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  // Debounce service search terms
  const [debouncedServiceSearch, setDebouncedServiceSearch] = useState("")
  const [debouncedDrugSearch, setDebouncedDrugSearch] = useState("")
  const [allServices, setAllServices] = useState<ServiceWithCoverage[]>([])
  const [isLoadingServices, setIsLoadingServices] = useState(false)

  // Form state for approval
  const [approvalForm, setApprovalForm] = useState({
    diagnosis: "",
    admission_required: false,
    services: [] as ServiceRequest[],
    coverage_status: "COVERED" as "COVERED" | "NOT_COVERED" | "EXCEEDED" | "REJECTED",
    remarks: ""
  })
  const [validationError, setValidationError] = useState<string>("")

  // Debounce service search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedServiceSearch(serviceSearchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [serviceSearchTerm])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedDrugSearch(drugSearchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [drugSearchTerm])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  // Get request ID from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const id = urlParams.get('id')
    if (id) {
      setRequestId(id)
      fetchApprovalRequest(id)
    } else {
      // No ID provided, stop loading and show error
      setIsLoading(false)
      toast({
        title: "Error",
        description: "No request ID provided in URL",
        variant: "destructive",
      })
    }
  }, [])

  // Fetch services when enrollee is available and search term changes
  useEffect(() => {
    if (approvalRequest?.enrollee_id) {
      // Combine both search terms to fetch all relevant services
      const combinedSearch = debouncedServiceSearch || debouncedDrugSearch
      fetchServicesWithCoverage(
        approvalRequest.enrollee_id,
        approvalRequest.provider_id,
        approvalRequest.tariff_type || "PRIVATE",
        combinedSearch
      )
    }
  }, [approvalRequest?.enrollee_id, approvalRequest?.provider_id, approvalRequest?.tariff_type, debouncedServiceSearch, debouncedDrugSearch])

  // Helper function to classify drug/pharmacy services across category variants
  const isDrugService = (service: ServiceWithCoverage) => {
    const category = String(service.service_category || "").toLowerCase()
    const name = String(service.service_name || "").toLowerCase()
    return (
      category.includes("drug") ||
      category.includes("pharmacy") ||
      category.includes("medication") ||
      category === "drg" ||
      name.includes("tablet") ||
      name.includes("capsule") ||
      name.includes("syrup") ||
      name.includes("injection") ||
      name.includes("multivitamin") ||
      name.includes("vaccine")
    )
  }

  const drugServices = allServices.filter(service => {
    const matchesSearch = !debouncedDrugSearch ||
      service.service_name.toLowerCase().includes(debouncedDrugSearch.toLowerCase())
    return isDrugService(service) && matchesSearch
  })

  const nonDrugServices = allServices.filter(service => {
    const matchesSearch = !debouncedServiceSearch ||
      service.service_name.toLowerCase().includes(debouncedServiceSearch.toLowerCase())
    return !isDrugService(service) && matchesSearch
  })

  // Fetch services with coverage status
  const fetchServicesWithCoverage = async (
    enrolleeId: string,
    providerId: string | undefined,
    tariffType: string,
    search: string
  ) => {
    try {
      setIsLoadingServices(true)
      const params = new URLSearchParams()
      params.append("enrollee_id", enrolleeId)
      if (search) params.append("search", search)
      let data: any = { services: [] }

      // Primary source: provider tariff services (or NHIA services)
      if (tariffType === "NHIA") {
        const res = await fetch(`/api/settings/service-types/nhia?${params}`)
        if (res.ok) {
          data = await res.json()
        }
      } else if (providerId) {
        const res = await fetch(`/api/provider/${providerId}/tariff-services?${params}`)
        if (res.ok) {
          data = await res.json()
        }
      }

      const mappedTariffServices: ServiceWithCoverage[] = (data?.services || []).map((s: any) => ({
        id: s.id,
        service_name: s.service_name || s.name || "",
        service_category: s.service_category || s.category_name || s.category || "",
        coverage_status: s.coverage_status || s.coverage || "COVERED",
        facility_price: Number(s.price || s.amount || s.facility_price || 0),
        limit_count: Number(s.limit_count || 0),
        selectable: s.selectable !== false,
        status_message: s.status_message || null,
        category_price_limit: s.category_price_limit ?? null,
        category_frequency_limit: s.category_frequency_limit ?? null,
        category_used_amount: Number(s.category_used_amount || 0),
        category_used_frequency: Number(s.category_used_frequency || 0),
        category_balance_amount: s.category_balance_amount ?? null,
        category_balance_frequency: s.category_balance_frequency ?? null,
      }))

      // Fallback: coverage endpoint, in case tariff is empty for this provider
      if (mappedTariffServices.length === 0) {
        const fallbackRes = await fetch(`/api/call-centre/services-coverage?${params}`)
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json()
          setAllServices(fallbackData.services || [])
          return
        }
      }

      setAllServices(mappedTariffServices)
    } catch (error) {
      console.error("Error fetching services:", error)
      toast({
        title: "Error",
        description: "Failed to fetch services",
        variant: "destructive",
      })
    } finally {
      setIsLoadingServices(false)
    }
  }

  // Fetch approval request details
  const fetchApprovalRequest = async (id: string) => {
    try {
      setIsLoading(true)
      console.log('Fetching request with ID:', id)
      const res = await fetch(`/api/call-centre/provider-requests/${id}`)
      console.log('Response status:', res.status)

      if (!res.ok) {
        const errorText = await res.text()
        console.error('API Error:', errorText)
        throw new Error(`Failed to fetch request details: ${res.status}`)
      }

      const data = await res.json()
      console.log('Fetched data:', data)
      setApprovalRequest(data.request)

      // Initialize form with request data
      setApprovalForm({
        diagnosis: data.request.diagnosis || "",
        admission_required: data.request.admission_required || false,
        services: (data.request.services || []).map((s: any, index: number) => ({
          ...s,
          id: String(s.id || s.service_id || `service-${index}`), // Ensure every service has a stable string ID
          quantity: s.quantity || 1,
          coverage: s.coverage || s.coverage_status || 'COVERED',
          // All services checked by default (eligible) for PENDING requests
          is_approved: data.request.status === 'PENDING' ? true : (s.coverage === 'COVERED' || s.coverage === 'EXCEEDED' || s.coverage_status === 'COVERED' || s.coverage_status === 'EXCEEDED')
        })),
        coverage_status: "COVERED",
        remarks: ""
      })
    } catch (error) {
      console.error('Fetch error:', error)
      toast({
        title: "Error",
        description: `Failed to fetch request details: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Approve request mutation
  const approveRequestMutation = useMutation({
    mutationFn: async (approvalData: any) => {
      const res = await fetch(`/api/call-centre/provider-requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(approvalData)
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to approve request')
      }
      return res.json()
    },
    onSuccess: (data) => {
      if (data.approval_code) {
        toast({
          title: "Request Approved",
          description: `Approval code ${data.approval_code} generated successfully`,
        })
      } else {
        toast({
          title: "Request Processed",
          description: data.message || "Request processed successfully",
        })
      }
      queryClient.invalidateQueries({ queryKey: ["provider-requests"] })
      queryClient.invalidateQueries({ queryKey: ["call-centre-metrics"] })
      router.push('/call-centre')
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve request",
        variant: "destructive",
      })
    },
  })

  // Reject request mutation
  const rejectRequestMutation = useMutation({
    mutationFn: async (rejectionData: any) => {
      const res = await fetch(`/api/call-centre/provider-requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rejectionData)
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to reject request')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Request Rejected",
        description: "Request has been rejected successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["provider-requests"] })
      router.push('/call-centre')
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject request",
        variant: "destructive",
      })
    },
  })

  const isDrug = (s: any) => {
    const cat = (s.service_category || s.category_name || s.category_id || '').toLowerCase()
    const name = (s.service_name || s.name || '').toLowerCase()
    return cat.includes('drug') || cat.includes('pharmacy') || cat.includes('medication') || cat === 'drg' ||
      name.includes('tablet') || name.includes('capsule') || name.includes('syrup') || name.includes('injection') ||
      name.includes('multivitamin') || name.includes('vaccine')
  }

  const handleConfirm = () => {
    if (!approvalRequest) return
    const isAddAfterApprovalFlow =
      approvalRequest.is_added_after_approval_request === true ||
      !!approvalRequest.original_approval_code
    const servicesToProcess = isAddAfterApprovalFlow
      ? approvalForm.services.filter((service) => (service as any).is_added_after_approval === true)
      : approvalForm.services

    if (servicesToProcess.length === 0) {
      toast({
        title: "Nothing to process",
        description: isAddAfterApprovalFlow
          ? "No newly added services found for approval in this request."
          : "No services found in this request.",
        variant: "destructive",
      })
      return
    }

    // Validate: Check if any rejected service (unchecked) is missing remarks
    const rejectedServices = servicesToProcess.filter(service => service.is_approved === false)
    const rejectedWithoutRemarks = rejectedServices.filter(service => !service.remarks?.trim())

    if (rejectedWithoutRemarks.length > 0) {
      const serviceNames = rejectedWithoutRemarks.map(s => s.service_name).join(', ')
      setValidationError(`Remarks are required for rejected services: ${serviceNames}. Please provide rejection reasons.`)
      toast({
        title: "Validation Error",
        description: `Remarks are required for all rejected services. Please provide rejection reasons for: ${serviceNames}`,
        variant: "destructive",
      })
      return
    }

    setValidationError("")

    // Prepare services with is_approved flag and rejection_reason
    const servicesWithApproval = servicesToProcess.map(service => ({
      ...service,
      id: service.id || `${service.service_name}-${Math.random()}`,
      is_approved: service.is_approved ?? true,
      approved_price: service.amount, // Use the edited amount as approved price
      rejection_reason: !service.is_approved ? (service.remarks || 'Service not covered or not selected') : undefined,
      coverage: service.is_approved ? (service.coverage === 'REJECTED' ? 'COVERED' : service.coverage) : 'REJECTED'
    }))

    const approvalData = {
      diagnosis: approvalForm.diagnosis,
      admission_required: approvalForm.admission_required,
      services: servicesWithApproval,
      remarks: approvalForm.remarks
    }

    approveRequestMutation.mutate(approvalData)
  }

  const handleEligibilityChange = (serviceId: string, isApproved: boolean) => {
    setApprovalForm(prev => ({
      ...prev,
      services: prev.services.map(service => {
        // Ensure both IDs are strings for comparison
        const serviceIdStr = String(service.id || '')
        const targetIdStr = String(serviceId || '')
        return serviceIdStr === targetIdStr
          ? {
            ...service,
            is_approved: isApproved, // Explicitly set boolean value
            // Clear remarks if re-approved
            remarks: isApproved ? "" : service.remarks
          }
          : service
      })
    }))
    // Clear validation error only if re-approved (remarks no longer required)
    // If unchecked, validation error will show on submit
    if (validationError && isApproved) {
      setValidationError("")
    }
  }

  const handleServiceCoverageChange = (serviceId: string, coverage: 'COVERED' | 'EXCEEDED' | 'NOT_COVERED' | 'REJECTED') => {
    setApprovalForm(prev => ({
      ...prev,
      services: prev.services.map(service =>
        service.id === serviceId ? { ...service, coverage } : service
      )
    }))
  }

  const handleServiceRemarksChange = (serviceId: string, remarks: string) => {
    setApprovalForm(prev => ({
      ...prev,
      services: prev.services.map(service =>
        service.id === serviceId ? { ...service, remarks } : service
      )
    }))
    // Clear validation error when remarks are entered
    if (validationError && remarks.trim()) {
      setValidationError("")
    }
  }

  const handleServiceAmountChange = (serviceId: string, amount: number) => {
    setApprovalForm(prev => ({
      ...prev,
      services: prev.services.map(service =>
        service.id === serviceId ? { ...service, amount } : service
      )
    }))
  }

  const handleServiceQuantityChange = (serviceId: string, quantity: number) => {
    setApprovalForm(prev => ({
      ...prev,
      services: prev.services.map(service =>
        service.id === serviceId ? { ...service, quantity } : service
      )
    }))
  }

  const handleAddService = (service: ServiceWithCoverage) => {
    if (!service.selectable) {
      toast({
        title: "Category Limit Reached",
        description: service.status_message || "This category has reached its configured limit for the enrollee.",
        variant: "destructive",
      })
      return
    }

    const newService: ServiceRequest & { service_category: string, is_added_after_approval: boolean } = {
      id: service.id,
      service_name: service.service_name,
      service_category: service.service_category,
      amount: service.facility_price,
      quantity: 1,
      coverage: 'COVERED',
      remarks: "",
      is_approved: true,
      is_added_after_approval: true
    }

    setApprovalForm(prev => ({
      ...prev,
      services: [...prev.services, newService]
    }))
  }

  const handleRemoveService = (serviceId: string) => {
    setApprovalForm(prev => ({
      ...prev,
      services: prev.services.filter(service => service.id !== serviceId)
    }))
  }

  const getCoverageStatusColor = (status: string) => {
    switch (status) {
      case "COVERED": return "bg-green-100 text-green-800"
      case "NOT_IN_PLAN": return "bg-yellow-100 text-yellow-800"
      case "NOT_ASSIGNED": return "bg-gray-100 text-gray-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getCoverageStatusText = (status: string) => {
    switch (status) {
      case "COVERED": return "Covered"
      case "NOT_IN_PLAN": return "Not in plan"
      case "NOT_ASSIGNED": return "Not assigned"
      default: return "Unknown"
    }
  }

  const formatAmount = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null || isNaN(amount)) {
      return '₦0'
    }
    return `₦${amount.toLocaleString()}`
  }
  const formatLimitAmount = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null || isNaN(amount as number)) {
      return "N/A"
    }
    return `₦${Number(amount).toLocaleString()}`
  }
  const metricByServiceName = allServices.reduce((acc, svc) => {
    const key = (svc.service_name || "").trim().toLowerCase()
    if (key) acc[key] = svc
    return acc
  }, {} as Record<string, ServiceWithCoverage>)

  const renderLimitMetrics = (serviceName?: string) => {
    const key = (serviceName || "").trim().toLowerCase()
    const metrics = metricByServiceName[key]
    if (!metrics) return null
    return (
      <div className="mt-1 text-[10px] text-gray-600">
        Limit: {formatLimitAmount(metrics.category_price_limit)} / {metrics.category_frequency_limit ?? "N/A"}x | Used: {formatLimitAmount(metrics.category_used_amount ?? 0)} / {metrics.category_used_frequency ?? 0}x | Balance: {formatLimitAmount(metrics.category_balance_amount)} / {metrics.category_balance_frequency ?? "N/A"}x
      </div>
    )
  }

  const isAddAfterApprovalFlow =
    approvalRequest?.is_added_after_approval_request === true ||
    !!approvalRequest?.original_approval_code
  // Only allow processing when the request is genuinely PENDING.
  // isAddAfterApprovalFlow does NOT grant editability for already-processed requests.
  const canProcessRequest = approvalRequest?.status === "PENDING"
  const canRejectPrimaryAutoApproved = approvalRequest?.status === "APPROVED" && approvalRequest?.is_primary_auto_approved === true
  const addServiceCountdown = approvalRequest?.add_service_expires_at
    ? (() => {
      const seconds = Math.max(
        0,
        Math.floor((new Date(approvalRequest.add_service_expires_at).getTime() - currentTime) / 1000)
      )
      return {
        expired: seconds <= 0,
        label: formatCountdown(seconds)
      }
    })()
    : null

  const renderServiceRow = (service: ServiceRequest) => {
    // CORRECT COLOR LOGIC:
    // Orange ONLY for: zero-price services OR ad-hoc services
    const isZeroPrice = service.tariff_price === 0 || service.amount === 0
    const isAdHoc = (service as any).is_ad_hoc === true
    const showOrange = isZeroPrice || isAdHoc

    // Blue for services added after approval
    const isAddedAfterApproval = (service as any).is_added_after_approval === true

    // Ensure is_approved is explicitly boolean - default to true if undefined
    const isApproved = service.is_approved !== undefined ? Boolean(service.is_approved) : true
    const isEditable = canProcessRequest

    return (
      <TableRow
        key={service.id}
        className={
          !isApproved && isEditable
            ? "bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500"
            : isAddedAfterApproval
              ? "bg-blue-50 hover:bg-blue-100 border-l-4 border-l-blue-500"
              : showOrange
                ? "bg-orange-100 hover:bg-orange-200 border-l-4 border-l-orange-500"
                : ""
        }
      >
        <TableCell>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{service.service_name}</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  service.is_primary ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
                }`}
              >
                {service.is_primary ? "Primary" : "Secondary"}
              </span>
            </div>
            {isAddedAfterApproval && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-200 text-blue-800 w-fit">
                Added Service
              </span>
            )}
            {renderLimitMetrics(service.service_name)}
            {service.provider_additional_comment && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 w-fit">
                Comment: {service.provider_additional_comment}
              </span>
            )}
            {showOrange && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-200 text-orange-800 w-fit">
                {isAdHoc ? "Ad-Hoc Service" : "Zero Price"}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <Input
            type="number"
            min="1"
            value={service.quantity || 1}
            onChange={(e) => handleServiceQuantityChange(service.id, parseInt(e.target.value) || 1)}
            className="w-20 h-8 font-semibold text-center"
            disabled={!isEditable}
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={service.amount}
            onChange={(e) => handleServiceAmountChange(service.id, parseFloat(e.target.value) || 0)}
            className={`w-32 h-8 ${showOrange ? 'border-orange-300 text-orange-700 font-bold' : 'font-semibold text-green-600'}`}
            disabled={!isEditable || !isApproved}
          />
        </TableCell>
        <TableCell className="font-semibold text-slate-700">
          ₦{lineTotal(service).toLocaleString()}
        </TableCell>
        <TableCell>
          {isEditable ? (
            <Checkbox
              checked={isApproved}
              onCheckedChange={(checked) => {
                const isChecked = checked === true
                handleEligibilityChange(String(service.id), isChecked)
              }}
            />
          ) : (
            <Badge className={
              service.coverage === 'COVERED' || service.coverage === 'EXCEEDED'
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }>
              {service.coverage === 'COVERED' ? 'Covered' :
                service.coverage === 'EXCEEDED' ? 'Exceeded' :
                  service.coverage === 'REJECTED' ? 'Rejected' : 'Not Covered'}
            </Badge>
          )}
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            <Input
              placeholder={!isApproved && isEditable ? "Required: Enter rejection reason" : "Optional remarks"}
              value={service.remarks || ""}
              onChange={(e) => handleServiceRemarksChange(service.id, e.target.value)}
              className={`w-48 ${!isApproved && isEditable ? 'border-red-300 focus:border-red-500 bg-red-50' : ''} ${!isApproved && isEditable && !service.remarks?.trim() ? 'ring-2 ring-red-500' : ''}`}
              readOnly={!isEditable}
              required={!isApproved && isEditable}
              aria-required={!isApproved && isEditable}
            />
            {!isApproved && isEditable && (
              <span className="text-xs text-red-600 font-medium">* Required</span>
            )}
          </div>
        </TableCell>
      </TableRow>
    )
  }

  const servicesForAction = isAddAfterApprovalFlow
    ? approvalForm.services.filter((service) => (service as any).is_added_after_approval === true)
    : approvalForm.services
  const primaryServices = servicesForAction.filter((service) => service.is_primary)
  const secondaryServices = servicesForAction.filter((service) => !service.is_primary)
  const hasMixedPrimarySecondary =
    !isAddAfterApprovalFlow &&
    approvalRequest?.status === "PENDING" &&
    primaryServices.length > 0 &&
    secondaryServices.length > 0
  const displayedServices = hasMixedPrimarySecondary ? secondaryServices : servicesForAction

  const parseMoney = (value: unknown) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0
    if (typeof value === "string") {
      const cleaned = value.replace(/[^\d.-]/g, "")
      const parsed = Number(cleaned)
      return Number.isFinite(parsed) ? parsed : 0
    }
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const lineTotal = (service: any) => {
    const unitAmount = parseMoney(
      service.amount ?? service.service_amount ?? service.tariff_price ?? 0
    )
    const qty = parseMoney(service.quantity ?? 1) || 1
    return unitAmount * qty
  }

  const isRejectedCoverage = (coverage?: string | null) =>
    ["REJECTED", "NOT_COVERED"].includes(String(coverage || "").toUpperCase())

  const shouldIncludeInSelectedSubtotal = (service: ServiceRequest) => {
    if (canProcessRequest) {
      // While processing, unchecked rows are treated as rejected and must not count.
      return service.is_approved !== false
    }
    // In read-only mode, rely on saved coverage status.
    return !isRejectedCoverage(service.coverage)
  }

  const selectedServicesSubtotal = displayedServices.reduce(
    (sum, service) =>
      shouldIncludeInSelectedSubtotal(service)
        ? sum + lineTotal(service)
        : sum,
    0
  )
  const approvedServicesSubtotal = (approvalRequest?.original_approval_services || []).reduce(
    (sum, service) =>
      (service.coverage === "REJECTED" || service.coverage === "NOT_COVERED")
        ? sum
        : sum + lineTotal(service),
    0
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!approvalRequest) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Request Not Found</h2>
          <p className="text-gray-600 mb-4">The requested approval code request could not be found.</p>
          <Button onClick={() => router.push('/call-centre')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Call Centre
          </Button>
        </div>
      </div>
    )
  }

  return (
    <PermissionGate module="call-centre" action="approve" actions={["approve", "add"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/call-centre')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Generate Code</h1>
              <p className="text-gray-600">Review and approve approval code request</p>
            </div>
          </div>
        </div>

        {/* Request Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Request from {approvalRequest.provider_name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enrollee Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-2 block">Enrollee ID</label>
                <div className="flex items-center gap-2">
                  <Input
                    value={approvalRequest.enrollee_id}
                    readOnly
                    className="font-mono"
                  />
                  <StatusIndicator status="ACTIVE" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-2 block">Enrollee Name</label>
                <Input value={approvalRequest.enrollee_name} readOnly />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-2 block">Organization</label>
                <Input value={approvalRequest.enrollee_organization_name || approvalRequest.organization} readOnly />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-2 block">Plan</label>
                <Input value={approvalRequest.enrollee_plan_name || approvalRequest.plan} readOnly />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-2 block">Provider Band</label>
                <Input value={approvalRequest.provider_bands?.join(", ") || "-"} readOnly />
              </div>
              {approvalRequest.original_approval_code && (
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-2 block">Original Approval Code</label>
                  <Input value={approvalRequest.original_approval_code} readOnly className="font-semibold text-blue-700" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-2 block">Gender</label>
                <Input value={approvalRequest.enrollee_gender || "-"} readOnly />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-2 block">Marital Status</label>
                <Input value={approvalRequest.enrollee_marital_status || "-"} readOnly />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-2 block">Plan Expiration</label>
                <Input
                  value={approvalRequest.enrollee_expiration_date ? new Date(approvalRequest.enrollee_expiration_date).toLocaleDateString("en-GB") : "-"}
                  readOnly
                />
              </div>
            </div>

            {/* Diagnosis */}
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">Diagnosis</label>
              <Input
                placeholder="Diagnosis"
                value={approvalForm.diagnosis}
                onChange={(e) => setApprovalForm(prev => ({ ...prev, diagnosis: e.target.value }))}
                readOnly={!canProcessRequest}
                className={!canProcessRequest ? 'bg-gray-50' : ''}
              />
            </div>

            {approvalRequest.added_services_comment && (
              <div>
                <label className="text-sm font-medium text-gray-600 mb-2 block">Added Services Comment</label>
                <Input value={approvalRequest.added_services_comment} readOnly className="bg-amber-50 border-amber-200" />
              </div>
            )}

            {approvalRequest.is_added_after_approval_request && addServiceCountdown && (
              <div className={`rounded-lg border p-4 ${addServiceCountdown.expired ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                <label className={`text-sm font-medium ${addServiceCountdown.expired ? 'text-red-800' : 'text-amber-800'}`}>
                  Add Service Countdown
                </label>
                <p className={`mt-1 text-sm ${addServiceCountdown.expired ? 'text-red-900' : 'text-amber-900'}`}>
                  {addServiceCountdown.expired
                    ? '24-hour add service window has elapsed.'
                    : `Time remaining: ${addServiceCountdown.label}`}
                </p>
              </div>
            )}



            {/* Previous Encounter and Admission */}
            <div className="flex items-center justify-between">
              <Button
              variant="outline"
              className="text-blue-600 border-blue-600"
              onClick={() => setShowHistoryModal(true)}
              >
              <History className="h-4 w-4 mr-2" />
              Previous Encounter
            </Button>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="admission"
                checked={approvalForm.admission_required}
                onChange={(e) => setApprovalForm(prev => ({ ...prev, admission_required: e.target.checked }))}
                disabled={!canProcessRequest}
                className="rounded"
              />
              <label htmlFor="admission" className="text-sm font-medium">Admission?</label>
            </div>
            </div>

            {/* Already Approved Services (for add-after-approval requests) */}
            {approvalRequest.original_approval_services && approvalRequest.original_approval_services.length > 0 && (
              <div className="mt-6 border rounded-lg overflow-hidden">
                <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
                  <h3 className="text-sm font-semibold text-blue-800">Already Approved Services ({approvalRequest.original_approval_code})</h3>
                </div>
                <Table>
                <TableHeader>
                  <TableRow>
                      <TableHead>SERVICE</TableHead>
                      <TableHead>QTY</TableHead>
                      <TableHead>AMOUNT</TableHead>
                      <TableHead>SUBTOTAL</TableHead>
                      <TableHead>TYPE</TableHead>
                  </TableRow>
                </TableHeader>
                  <TableBody>
                    {approvalRequest.original_approval_services.map((service) => (
                      <TableRow
                        key={service.id}
                        className={
                          (service.coverage === "REJECTED" || service.coverage === "NOT_COVERED")
                            ? "bg-red-50/40"
                            : "bg-blue-50/40"
                        }
                      >
                        <TableCell className="font-medium">
                          {service.service_name}
                          {renderLimitMetrics(service.service_name)}
                          {(service.coverage === "REJECTED" || service.coverage === "NOT_COVERED") && service.rejection_reason && (
                            <p className="text-xs text-red-600 mt-1">{service.rejection_reason}</p>
                          )}
                        </TableCell>
                        <TableCell>{service.quantity || 1}</TableCell>
                        <TableCell
                          className={
                            (service.coverage === "REJECTED" || service.coverage === "NOT_COVERED")
                              ? "font-semibold text-red-700"
                              : "font-semibold text-blue-700"
                          }
                        >
                          ₦{Number(service.amount || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-700">
                          ₦{lineTotal(service).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {service.coverage === "REJECTED" || service.coverage === "NOT_COVERED" ? (
                            <Badge className="bg-red-100 text-red-800">Rejected</Badge>
                          ) : service.is_ad_hoc ? (
                            <Badge className="bg-orange-100 text-orange-800">Ad-Hoc</Badge>
                          ) : (
                            <Badge className="bg-[#BE1522] text-white">Also Approved</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex justify-end border-t bg-blue-50/40 px-4 py-3">
                  <div className="text-right">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Subtotal</p>
                    <p className="text-lg font-black text-blue-800">₦{approvedServicesSubtotal.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Add Extra Services Section */}
            {canProcessRequest && (
            <div className="mt-8 pt-8 border-t border-dashed space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-blue-500" />
                  Add Extra Service / Drug
                </h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border">
                {/* Medical Services Search */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-blue-700 flex items-center gap-2">
                    <Stethoscope className="h-3.5 w-3.5" />
                    Medical Services
                  </Label>
                  <div className="relative">
                    <div className="relative">
                      <Input
                        placeholder="Search medical service..."
                        value={serviceSearchTerm}
                        onChange={(e) => {
                          setServiceSearchTerm(e.target.value)
                          setDrugSearchTerm("")
                          setShowServiceModal(true)
                        }}
                      />
                      <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    </div>

                    {showServiceModal && serviceSearchTerm && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {isLoadingServices ? (
                          <div className="px-4 py-3 text-gray-500 text-sm flex items-center gap-2">
                            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" /> Loading...
                          </div>
                        ) : nonDrugServices.length > 0 ? (
                          nonDrugServices.map((s: any) => (
                            <div
                              key={s.id}
                              className={`px-4 py-3 border-b border-gray-100 last:border-b-0 ${s.selectable ? 'hover:bg-gray-50 cursor-pointer' : 'bg-gray-50 cursor-not-allowed opacity-70'}`}
                              onClick={() => {
                                handleAddService(s)
                                setServiceSearchTerm("")
                                setShowServiceModal(false)
                              }}
                            >
                              <div className="flex justify-between">
                                <span className="font-medium text-gray-900">{s.service_name}</span>
                                <span className="font-bold text-blue-600">₦{Number(s.facility_price || 0).toLocaleString()}</span>
                              </div>
                              <div className="text-[10px] text-gray-500">{s.service_category}</div>
                              <div className="mt-1 text-[10px] text-gray-600">
                                Limit: {formatLimitAmount(s.category_price_limit)} / {s.category_frequency_limit ?? "N/A"}x | Used: {formatLimitAmount(s.category_used_amount ?? 0)} / {s.category_used_frequency ?? 0}x | Balance: {formatLimitAmount(s.category_balance_amount)} / {s.category_balance_frequency ?? "N/A"}x
                              </div>
                              {!s.selectable && (
                                <div className="mt-1 text-[10px] text-red-600 font-medium">
                                  {s.status_message || "Category limit exhausted"}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-gray-500 text-sm">No services found.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Drugs Search */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-green-700 flex items-center gap-2">
                    <Pill className="h-3.5 w-3.5" />
                    Drugs / Pharmaceuticals
                  </Label>
                  <div className="relative">
                    <div className="relative">
                      <Input
                        placeholder="Search drugs..."
                        value={drugSearchTerm}
                        onChange={(e) => {
                          setDrugSearchTerm(e.target.value)
                          setServiceSearchTerm("")
                          setShowServiceModal(true)
                        }}
                      />
                      <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    </div>

                    {showServiceModal && drugSearchTerm && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {isLoadingServices ? (
                          <div className="px-4 py-3 text-gray-500 text-sm flex items-center gap-2">
                            <div className="animate-spin h-4 w-4 border-2 border-green-500 border-t-transparent rounded-full" /> Loading...
                          </div>
                        ) : drugServices.length > 0 ? (
                          drugServices.map((s: any) => (
                            <div
                              key={s.id}
                              className={`px-4 py-3 border-b border-gray-100 last:border-b-0 ${s.selectable ? 'hover:bg-gray-50 cursor-pointer' : 'bg-gray-50 cursor-not-allowed opacity-70'}`}
                              onClick={() => {
                                handleAddService(s)
                                setDrugSearchTerm("")
                                setShowServiceModal(false)
                              }}
                            >
                              <div className="flex justify-between">
                                <span className="font-medium text-gray-900">{s.service_name}</span>
                                <span className="font-bold text-green-600">₦{Number(s.facility_price || 0).toLocaleString()}</span>
                              </div>
                              <div className="text-[10px] text-gray-500">{s.service_category}</div>
                              <div className="mt-1 text-[10px] text-gray-600">
                                Limit: {formatLimitAmount(s.category_price_limit)} / {s.category_frequency_limit ?? "N/A"}x | Used: {formatLimitAmount(s.category_used_amount ?? 0)} / {s.category_used_frequency ?? 0}x | Balance: {formatLimitAmount(s.category_balance_amount)} / {s.category_balance_frequency ?? "N/A"}x
                              </div>
                              {!s.selectable && (
                                <div className="mt-1 text-[10px] text-red-600 font-medium">
                                  {s.status_message || "Category limit exhausted"}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-gray-500 text-sm">No drugs found.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {hasMixedPrimarySecondary && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-green-700">Primary Services</CardTitle>
            <CardDescription>Review primary services — mark eligibility and add remarks where needed.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-gray-600">SERVICE</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">QTY</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">SUBTOTAL</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">ELIGIBILITY</TableHead>
                  <TableHead className="text-xs font-medium text-gray-600">REMARKS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {primaryServices.map((service) => renderServiceRow(service))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Selected Services */}
      <Card>
        <CardHeader>
          <CardTitle className="text-blue-600">
            {isAddAfterApprovalFlow
              ? (canProcessRequest ? "Pending Added Services" : "Processed Added Services")
              : hasMixedPrimarySecondary
                ? "Pending Secondary Services"
                : "Selected Services"}
          </CardTitle>
          <CardDescription>
            {isAddAfterApprovalFlow
              ? (canProcessRequest
                  ? "Review and process only the newly added services for this existing approval code"
                  : "These services have already been processed for this approval code")
              : hasMixedPrimarySecondary
                ? "Review and process pending secondary services for call-centre approval"
                : "Review and manage selected services"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-medium text-gray-600">SERVICE</TableHead>
                <TableHead className="text-xs font-medium text-gray-600">QTY</TableHead>
                <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                <TableHead className="text-xs font-medium text-gray-600">SUBTOTAL</TableHead>
                <TableHead className="text-xs font-medium text-gray-600">ELIGIBILITY</TableHead>
                <TableHead className="text-xs font-medium text-gray-600">REMARKS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Mixed request mode: show only pending secondary services in this table */}
              {/* Grouped Rendering: Medical Services First */}
              {(hasMixedPrimarySecondary ? secondaryServices : servicesForAction).filter(s => !isDrug(s)).length > 0 && (
                <TableRow className="bg-blue-50/50 hover:bg-blue-50/50">
                  <TableCell colSpan={6} className="py-2">
                    <div className="flex items-center gap-2 text-blue-700 font-bold text-[10px] uppercase tracking-wider">
                      <Stethoscope className="h-3 w-3" /> {hasMixedPrimarySecondary ? "Pending Medical Services" : "Medical Services"}
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {(hasMixedPrimarySecondary ? secondaryServices : servicesForAction).filter(s => !isDrug(s)).map((service) => {
                return renderServiceRow(service)
              })}

              {/* Drugs Section */}
              {(hasMixedPrimarySecondary ? secondaryServices : servicesForAction).filter(s => isDrug(s)).length > 0 && (
                <TableRow className="bg-green-50/50 hover:bg-green-50/50">
                  <TableCell colSpan={6} className="py-2">
                    <div className="flex items-center gap-2 text-green-700 font-bold text-[10px] uppercase tracking-wider">
                      <Pill className="h-3 w-3" /> {hasMixedPrimarySecondary ? "Pending Drugs / Pharmaceuticals" : "Drugs / Pharmaceuticals"}
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {(hasMixedPrimarySecondary ? secondaryServices : servicesForAction).filter(s => isDrug(s)).map((service) => {
                return renderServiceRow(service)
              })}

              {(hasMixedPrimarySecondary ? secondaryServices : servicesForAction).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500 italic">
                    No services or drugs selected.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="flex justify-end border-t bg-gray-50 px-4 py-3">
            <div className="text-right">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Subtotal (Services + Drugs)</p>
              <p className="text-xl font-black text-gray-900">₦{selectedServicesSubtotal.toLocaleString()}</p>
            </div>
          </div>
          {validationError && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-md">
              <div className="flex items-start gap-2">
                <span className="font-semibold">⚠️ Validation Error:</span>
                <span>{validationError}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
          <Button
          variant="outline"
          onClick={() => router.push('/call-centre')}
          className="px-8"
        >
          {canProcessRequest ? 'Cancel' : 'Close'}
        </Button>
        {canProcessRequest && (
          <>
            <Button
              onClick={handleConfirm}
              disabled={approveRequestMutation.isPending || rejectRequestMutation.isPending}
              className="bg-[#BE1522] hover:bg-[#9B1219] px-8"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {(approveRequestMutation.isPending || rejectRequestMutation.isPending) ? "Processing..." : "Confirm"}
            </Button>
          </>
        )}
        {canRejectPrimaryAutoApproved && (
          <Button
            variant="destructive"
            onClick={() => setShowRejectModal(true)}
            disabled={rejectRequestMutation.isPending}
            className="px-8"
          >
            <XCircle className="h-4 w-4 mr-2" />
            {rejectRequestMutation.isPending ? "Rejecting..." : "Reject"}
          </Button>
        )}
      </div>

      {/* Previous Encounter Modal */}
      {approvalRequest && (
        <PreviousEncounterModal
          isOpen={showHistoryModal}
          onOpenChange={setShowHistoryModal}
          enrolleeId={approvalRequest.beneficiary_id || approvalRequest.enrollee_id}
          enrolleeName={approvalRequest.enrollee_name}
        />
      )}

      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Primary Auto-Approved Request</DialogTitle>
            <DialogDescription>
              This will reject the auto-approved primary request and reverse its approval status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Rejection Reason</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectModal(false)
                setRejectReason("")
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={rejectRequestMutation.isPending || !rejectReason.trim()}
              onClick={() => {
                rejectRequestMutation.mutate({ reason: rejectReason.trim() }, {
                  onSuccess: () => {
                    setShowRejectModal(false)
                    setRejectReason("")
                  }
                })
              }}
            >
              {rejectRequestMutation.isPending ? "Rejecting..." : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PermissionGate >
  )
}
