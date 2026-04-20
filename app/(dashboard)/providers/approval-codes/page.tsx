"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  TrendingUp,
  Users,
  DollarSign,
  MoreVertical,
  Plus,
  X,
  Loader2
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { formatCountdown } from "@/lib/add-service-window"
import {


  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ApprovalCode {
  id: string
  approval_code: string
  hospital: string
  services: string | any // Can be string or object
  amount: number
  status: 'PENDING' | 'APPROVED' | 'PARTIAL' | 'REJECTED'
  date: string
  claim_id: string
  provider_id: string
  rejection_reason?: string
  all_services?: string // All services including rejected ones
  enrollee_plan?: string
  enrollee_bands?: string[]
  band_summary?: {
    total_bands: number
    bands: string[]
    message: string
  }
  source_type?: 'approval_code' | 'provider_request'
  is_primary_auto_approved?: boolean
  add_service_expires_at?: string | null
  add_service_seconds_remaining?: number
  add_service_window_expired?: boolean
  provider: {
    id: string
    facility_name: string | null
    facility_type: string | null
  }
  enrollee: {
    id: string
    first_name: string
    last_name: string
    enrollee_id: string
    plan?: {
      id: string
      name: string
      assigned_bands: string[]
      band_type: string
    }
    bands?: string[]
  }
}

interface ApprovalCodesResponse {
  approval_codes: ApprovalCode[]
  pagination?: {
    current_page?: number
    total_pages?: number
    total_count?: number
    has_next_page?: boolean
    has_prev_page?: boolean
    page?: number
    pages?: number
    total?: number
    limit?: number
  }
  warning?: string
}

export default function ApprovalCodePage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Modal state
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedApprovalCode, setSelectedApprovalCode] = useState<ApprovalCode | null>(null)
  const [showAddServiceModal, setShowAddServiceModal] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  const [expandedServicesRows, setExpandedServicesRows] = useState<Record<string, boolean>>({})

  // Add Service Logic
  const [serviceSearchTerm, setServiceSearchTerm] = useState("")
  const [debouncedServiceSearch, setDebouncedServiceSearch] = useState("")
  const [showServiceResults, setShowServiceResults] = useState(false)
  const [drugSearchTerm, setDrugSearchTerm] = useState("")
  const [debouncedDrugSearch, setDebouncedDrugSearch] = useState("")
  const [showDrugResults, setShowDrugResults] = useState(false)
  const [addingServices, setAddingServices] = useState<any[]>([])
  const [addServiceComment, setAddServiceComment] = useState("")
  const [addServiceDiagnosis, setAddServiceDiagnosis] = useState("")
  const [adHocType, setAdHocType] = useState<"SERVICE" | "DRUG">("SERVICE")
  const [adHocServiceName, setAdHocServiceName] = useState("")
  const [adHocServicePrice, setAdHocServicePrice] = useState("")
  const [adHocServiceQuantity, setAdHocServiceQuantity] = useState("1")

  // Fetch detailed approval code info when viewing
  const { data: detailedApprovalCode, isLoading: isLoadingDetails } = useQuery({
    queryKey: ["approval-code-details", selectedApprovalCode?.id],
    queryFn: async () => {
      if (!selectedApprovalCode?.id) return null
      const res = await fetch(`/api/providers/approval-codes/${selectedApprovalCode.id}`)
      if (!res.ok) throw new Error("Failed to fetch approval code details")
      return res.json()
    },
    enabled: !!selectedApprovalCode?.id && (showViewModal || showAddServiceModal)
  })

  useEffect(() => {
    if (!showAddServiceModal) return

    const diagnosis = detailedApprovalCode?.approval_code?.diagnosis
    if (typeof diagnosis === "string") {
      setAddServiceDiagnosis(diagnosis)
    }
  }, [showAddServiceModal, detailedApprovalCode?.approval_code?.diagnosis])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

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

  const providerIdForServices =
    selectedApprovalCode?.provider_id ||
    detailedApprovalCode?.approval_code?.provider_id

  // Fetch services for the selected approval code's provider
  const { data: providerServicesData, isLoading: isLoadingServices } = useQuery({
    queryKey: ["provider-services", providerIdForServices],
    queryFn: async () => {
      if (!providerIdForServices) return { services: [] }
      const res = await fetch(`/api/provider/${providerIdForServices}/tariff-services`)
      if (!res.ok) return { services: [] }
      return res.json()
    },
    enabled: showAddServiceModal && !!providerIdForServices
  })

  const addServiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/providers/approval-codes/${selectedApprovalCode?.id}/add-services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to add services")
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast({
        title: "Services Added",
        description: data.message || "New services have been sent for approval.",
      })
      setShowAddServiceModal(false)
      setAddingServices([])
      setServiceSearchTerm("")
      setDrugSearchTerm("")
      setShowServiceResults(false)
      setShowDrugResults(false)
      setAdHocServiceName("")
      setAdHocServicePrice("")
      setAdHocServiceQuantity("1")
      setAdHocType("SERVICE")
      setAddServiceComment("")
      setAddServiceDiagnosis("")
      queryClient.invalidateQueries({ queryKey: ["approval-codes"] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  })

  // Fetch approval codes
  const { data: approvalCodesData, isLoading, error, isError } = useQuery<ApprovalCodesResponse>({
    queryKey: ["approval-codes", currentPage, limit, debouncedSearchTerm, selectedStatus, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
      })

      const res = await fetch(`/api/providers/approval-codes?${params}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to fetch approval codes")
      }
      const data = await res.json()

      // Show warning if account not linked to provider
      if (data.warning) {
        toast({
          title: "Account Setup Required",
          description: data.warning,
          variant: "destructive",
        })
      }

      return data
    },
    retry: 1,
  })

  useEffect(() => {
    if (isError) {
      toast({
        title: "Error Loading Approval Codes",
        description: error instanceof Error ? error.message : "Unable to load approval codes. Please try again.",
        variant: "destructive",
      })
    }
  }, [isError, error, toast])

  const approvalCodes = approvalCodesData?.approval_codes || []
  const pagination = approvalCodesData?.pagination
  const rawPage = pagination?.current_page ?? pagination?.page ?? currentPage
  const rawPages = pagination?.total_pages ?? pagination?.pages ?? 1
  const rawTotal = pagination?.total_count ?? pagination?.total ?? approvalCodes.length
  const rawLimit = pagination?.limit ?? limit
  const safePage = Number.isFinite(Number(rawPage)) ? Math.max(1, Number(rawPage)) : 1
  const safeTotalPages = Number.isFinite(Number(rawPages)) ? Math.max(1, Number(rawPages)) : 1
  const safeTotal = Number.isFinite(Number(rawTotal)) ? Math.max(0, Number(rawTotal)) : 0
  const safeLimit = Number.isFinite(Number(rawLimit)) ? Math.max(1, Number(rawLimit)) : limit
  const startResult = safeTotal === 0 ? 0 : ((safePage - 1) * safeLimit) + 1
  const endResult = safeTotal === 0 ? 0 : Math.min(safePage * safeLimit, safeTotal)

  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  // Handle export
  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
      })

      const res = await fetch(`/api/providers/approval-codes/export?${params}`)
      if (!res.ok) {
        throw new Error("Failed to export approval codes")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `approval-codes-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Success",
        description: "Approval codes exported successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export approval codes",
        variant: "destructive",
      })
    }
  }

  const handleViewApprovalCode = (approvalCode: ApprovalCode) => {
    setSelectedApprovalCode(approvalCode)
    setShowViewModal(true)
  }

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    if (!status) return 'bg-gray-100 text-gray-800'

    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-orange-100 text-orange-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getSafeStatus = (status?: string | null) => status || 'PENDING'

  const getStatusLabel = (status?: string | null) => {
    const safeStatus = getSafeStatus(status)
    return safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1).toLowerCase()
  }

  const getProviderName = (approvalCode: ApprovalCode) =>
    approvalCode.provider?.facility_name || approvalCode.hospital || "Unknown Provider"

  const getProviderInitials = (approvalCode: ApprovalCode) =>
    getProviderName(approvalCode)
      .split(' ')
      .filter(Boolean)
      .map((word: string) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

  const isDrugService = (service: any) => {
    const categoryId = String(service?.category_id || service?.category || "").toUpperCase()
    const category = String(service?.category_name || service?.service_category || "").toLowerCase()
    const name = String(service?.service_name || service?.name || "").toLowerCase()
    return (
      categoryId === "DRG" ||
      category.includes("drug") ||
      category.includes("pharmacy") ||
      category.includes("medication") ||
      name.includes("tablet") ||
      name.includes("capsule") ||
      name.includes("syrup") ||
      name.includes("injection")
    )
  }

  const isWithinAddServiceWindow = (approvalCode: ApprovalCode) => {
    if (approvalCode.add_service_expires_at) {
      return new Date(approvalCode.add_service_expires_at).getTime() > currentTime
    }

    const codeDate = new Date(approvalCode.date)
    return (currentTime - codeDate.getTime()) <= (24 * 60 * 60 * 1000)
  }

  const getAddServiceCountdown = (approvalCode: ApprovalCode) => {
    if (!approvalCode.add_service_expires_at) return null
    const remainingSeconds = Math.max(
      0,
      Math.floor((new Date(approvalCode.add_service_expires_at).getTime() - currentTime) / 1000)
    )
    return formatCountdown(remainingSeconds)
  }

  const canAddServices = (approvalCode: ApprovalCode) => {
    if (approvalCode.status !== "APPROVED" && approvalCode.status !== "PARTIAL") {
      return false
    }

    return isWithinAddServiceWindow(approvalCode) && !(approvalCode as any).has_pending_services
  }

  // Helper function to format services data
  const formatServices = (services: any): string => {
    if (typeof services === 'string') {
      // Try to parse JSON string
      try {
        const parsed = JSON.parse(services)
        if (Array.isArray(parsed)) {
          return parsed.map((service: any) => {
            if (typeof service === 'string') {
              return service
            } else if (service && typeof service === 'object') {
              return service.service_name || service.name || service.title ||
                service.description || 'Service'
            }
            return String(service)
          }).join(', ')
        } else if (parsed && typeof parsed === 'object') {
          return parsed.service_name || parsed.name || parsed.title ||
            parsed.description || 'Service'
        }
        return services
      } catch (error) {
        // If not JSON, return as is
        return services
      }
    }

    if (Array.isArray(services)) {
      // Handle array of objects or strings
      return services.map((service: any) => {
        if (typeof service === 'string') {
          return service
        } else if (service && typeof service === 'object') {
          // Try different property names for service name
          return service.service_name || service.name || service.title ||
            service.description || JSON.stringify(service)
        }
        return String(service)
      }).join(', ')
    }

    if (services && typeof services === 'object') {
      // Handle single object
      return services.service_name || services.name || services.title ||
        services.description || 'Service'
    }

    return 'General Service'
  }

  const isServicesRowExpanded = (approvalCodeId: string) => Boolean(expandedServicesRows[approvalCodeId])

  const toggleServicesRow = (approvalCodeId: string) => {
    setExpandedServicesRows((prev) => ({
      ...prev,
      [approvalCodeId]: !prev[approvalCodeId]
    }))
  }

  const getAllServicesForBreakdown = () => {
    const rawServices =
      detailedApprovalCode?.approval_code?.all_services ||
      detailedApprovalCode?.approval_code?.services ||
      selectedApprovalCode?.all_services ||
      selectedApprovalCode?.services

    if (!rawServices) return []

    if (Array.isArray(rawServices)) return rawServices

    if (typeof rawServices === 'string') {
      try {
        const parsed = JSON.parse(rawServices)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }

    return []
  }

  const effectiveSelectedStatus =
    detailedApprovalCode?.approval_code?.status ||
    selectedApprovalCode?.status ||
    'PENDING'

  const effectiveSelectedRejectionReason =
    detailedApprovalCode?.approval_code?.rejection_reason ||
    selectedApprovalCode?.rejection_reason ||
    null

  const isApprovedCoverage = (service: any) => {
    const coverage = String(service?.coverage || service?.coverage_status || "").toUpperCase()
    return coverage === "COVERED" || coverage === "EXCEEDED" || coverage === "LIMIT_EXCEEDED"
  }

  const isRejectedCoverage = (service: any) => {
    const coverage = String(service?.coverage || service?.coverage_status || "").toUpperCase()
    return (
      coverage === "REJECTED" ||
      coverage === "NOT_COVERED" ||
      coverage === "NOT_IN_PLAN" ||
      coverage === "NOT_ASSIGNED" ||
      coverage === "NOT_IN_BAND"
    )
  }

  const allProviderServices = providerServicesData?.services || []
  const filteredMedicalServices = allProviderServices.filter((service: any) => {
    if (isDrugService(service)) return false
    if (!serviceSearchTerm.trim()) return true
    const term = serviceSearchTerm.toLowerCase()
    const name = String(service.service_name || service.name || "").toLowerCase()
    const category = String(service.category_name || service.service_category || "").toLowerCase()
    return name.includes(term) || category.includes(term)
  })
  const filteredDrugServices = allProviderServices.filter((service: any) => {
    if (!isDrugService(service)) return false
    if (!drugSearchTerm.trim()) return true
    const term = drugSearchTerm.toLowerCase()
    const name = String(service.service_name || service.name || "").toLowerCase()
    const category = String(service.category_name || service.service_category || "").toLowerCase()
    return name.includes(term) || category.includes(term)
  })

  return (
    <PermissionGate module="provider" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Approval Code</h1>
            <p className="text-gray-600">Manage approval codes for claims</p>
          </div>
          <div className="flex gap-4">
            <PermissionGate module="provider" action="add">
              <Button
                onClick={() => router.push("/providers/request-approval-code")}
                className="bg-[#BE1522] hover:bg-[#9B1219]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Request Code
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Approval Code Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium">Search Approval Code</label>
                <Input
                  placeholder="Search by name"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={selectedStatus} onValueChange={(value) => {
                  setSelectedStatus(value)
                  handleFilterChange()
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="PARTIAL">Partial</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  placeholder="dd-mm-yy"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    handleFilterChange()
                  }}
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  placeholder="dd-mm-yy"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    handleFilterChange()
                  }}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleFilterChange} className="bg-[#BE1522] hover:bg-[#9B1219]">
                  <Filter className="h-4 w-4 mr-2" />
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Approval Code Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Approval Code</CardTitle>
                <CardDescription className="mt-2">Manage approval codes and their status</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertTriangle className="h-16 w-16 text-red-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Approval Codes</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {(error as Error)?.message || 'An error occurred while loading approval codes'}
                </p>
                <Button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['approval-codes'] })}
                  className="bg-[#BE1522] hover:bg-[#9B1219]"
                >
                  Try Again
                </Button>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : approvalCodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Approval Codes Found</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {debouncedSearchTerm || selectedStatus !== 'all' || startDate || endDate
                    ? 'No approval codes match your search criteria. Try adjusting your filters.'
                    : 'You don\'t have any approval codes yet. Approval codes will appear here once submitted.'}
                </p>
                {(debouncedSearchTerm || selectedStatus !== 'all' || startDate || endDate) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('')
                      setDebouncedSearchTerm('')
                      setSelectedStatus('all')
                      setStartDate('')
                      setEndDate('')
                      setCurrentPage(1)
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-gray-600">APPROVAL CODE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ENROLLEE NAME</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ENROLLEE ID</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">HOSPITAL</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">SERVICES</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvalCodes.map((approvalCode: ApprovalCode) => (
                      <TableRow key={approvalCode.id}>
                        <TableCell className="font-medium">
                          {getSafeStatus(approvalCode.status) === 'APPROVED' || getSafeStatus(approvalCode.status) === 'PARTIAL' || getSafeStatus(approvalCode.status) === 'REJECTED' ? (
                            approvalCode.approval_code
                          ) : (
                            <span className="text-orange-600 italic">Pending Approval</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {approvalCode.enrollee?.first_name} {approvalCode.enrollee?.last_name}
                        </TableCell>
                        <TableCell>
                          {approvalCode.enrollee?.enrollee_id || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-red-400">
                                {getProviderInitials(approvalCode)}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{getProviderName(approvalCode)}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const servicesText = formatServices(approvalCode.services)
                            const isExpanded = isServicesRowExpanded(approvalCode.id)
                            const shouldCollapse = servicesText.length > 120
                            const previewText = shouldCollapse ? `${servicesText.slice(0, 120)}...` : servicesText

                            return (
                              <div className="max-w-[260px]">
                                <p className="text-sm leading-5 break-words whitespace-normal">
                                  {isExpanded ? servicesText : previewText}
                                </p>
                                {shouldCollapse && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 mt-1 text-xs text-[#BE1522] hover:text-[#9B1219] hover:bg-transparent"
                                    onClick={() => toggleServicesRow(approvalCode.id)}
                                  >
                                    {isExpanded ? "Show less" : "Show more"}
                                  </Button>
                                )}
                              </div>
                            )
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-sm px-2 py-1 rounded-full ${approvalCode.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                              approvalCode.status === 'PARTIAL' ? 'bg-orange-100 text-orange-800' :
                                approvalCode.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                              }`}>
                              {getStatusLabel(approvalCode.status)}
                            </span>
                            {approvalCode.is_primary_auto_approved && (
                              <Badge className="bg-slate-100 text-slate-700 border border-slate-200 text-xs">
                                Primary Auto-Approved
                              </Badge>
                            )}
                          </div>
                          {(approvalCode.status === 'APPROVED' || approvalCode.status === 'PARTIAL') && (
                            <div className={`mt-1 text-xs ${isWithinAddServiceWindow(approvalCode) ? 'text-amber-700' : 'text-gray-400'}`}>
                              {isWithinAddServiceWindow(approvalCode)
                                ? `Add service closes in ${getAddServiceCountdown(approvalCode) || "24:00:00"}`
                                : "Add service window elapsed"}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(approvalCode.date).toLocaleDateString('en-GB')}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {approvalCode.source_type !== 'provider_request' && (
                                <DropdownMenuItem
                                  onClick={() => handleViewApprovalCode(approvalCode)}
                                  className="w-full justify-start text-xs"
                                >
                                  View Details
                                </DropdownMenuItem>
                              )}
                              {(approvalCode.status === 'APPROVED' || approvalCode.status === 'PARTIAL') && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (!canAddServices(approvalCode)) return
                                    setSelectedApprovalCode(approvalCode)
                                    setShowAddServiceModal(true)
                                    setAddingServices([])
                                    setAdHocServiceName("")
                                    setAdHocServicePrice("")
                                    setAdHocServiceQuantity("1")
                                    setAdHocType("SERVICE")
                                    setAddServiceComment("")
                                    setAddServiceDiagnosis("")
                                    setServiceSearchTerm("")
                                    setDrugSearchTerm("")
                                  }}
                                  className={`w-full justify-start text-xs ${
                                    canAddServices(approvalCode)
                                      ? "text-blue-600"
                                      : "cursor-not-allowed text-gray-400 opacity-50 pointer-events-none"
                                  }`}
                                  disabled={!canAddServices(approvalCode)}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  {!isWithinAddServiceWindow(approvalCode)
                                    ? "Add Service (Expired)"
                                    : (approvalCode as any).has_pending_services
                                      ? "Add Service (Pending Approval)"
                                      : "Add Service"}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {pagination && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-600">
                      Showing {startResult} to {endResult} of {safeTotal} results
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={safePage <= 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {safePage} of {safeTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, safeTotalPages))}
                        disabled={safePage >= safeTotalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* View Approval Code Modal */}
        {showViewModal && selectedApprovalCode && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <span className="text-blue-600">Approval Code Details</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowViewModal(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  Approval Code: {getSafeStatus(selectedApprovalCode.status) === 'APPROVED' || getSafeStatus(selectedApprovalCode.status) === 'PARTIAL' || getSafeStatus(selectedApprovalCode.status) === 'REJECTED' ? selectedApprovalCode.approval_code : 'Pending Approval'}
                </CardDescription>
              </CardHeader>
              <CardContent>

                <div className="space-y-6">
                  {/* Approval Code Information */}
                  <div>
                    <h3 className="text-blue-600 font-semibold mb-4">Approval Code Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Approval Code</label>
                        <p className="text-sm font-semibold">
                          {getSafeStatus(selectedApprovalCode.status) === 'APPROVED' || getSafeStatus(selectedApprovalCode.status) === 'PARTIAL' || getSafeStatus(selectedApprovalCode.status) === 'REJECTED' ? selectedApprovalCode.approval_code : 'Pending Approval'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Status</label>
                        <p className="text-lg text-gray-900">
                          {getStatusLabel(selectedApprovalCode.status)}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Enrollee Name</label>
                        <p className="text-sm">{selectedApprovalCode.enrollee?.first_name} {selectedApprovalCode.enrollee?.last_name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Enrollee ID</label>
                        <p className="text-sm">{selectedApprovalCode.enrollee?.enrollee_id || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Provider Information */}
                  <div>
                    <h3 className="text-blue-600 font-semibold mb-4">Provider Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Hospital</label>
                        <p className="text-sm">{selectedApprovalCode.hospital}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Provider Name</label>
                        <p className="text-sm">{getProviderName(selectedApprovalCode)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Provider Type</label>
                        <p className="text-sm">{selectedApprovalCode.provider?.facility_type || 'HOSPITAL'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Clinical Information */}
                  {detailedApprovalCode?.approval_code?.diagnosis || detailedApprovalCode?.approval_code?.clinical_encounter ? (
                    <div>
                      <h3 className="text-blue-600 font-semibold mb-4">Clinical Information</h3>
                      <div className="space-y-3">
                        {detailedApprovalCode?.approval_code?.diagnosis && (
                          <div>
                            <label className="text-sm font-medium text-gray-600">Diagnosis</label>
                            <p className="text-sm text-gray-900 mt-1">{detailedApprovalCode.approval_code.diagnosis}</p>
                          </div>
                        )}
                        {detailedApprovalCode?.approval_code?.clinical_encounter && (
                          <div>
                            <label className="text-sm font-medium text-gray-600">Clinical Findings / Encounter Notes</label>
                            <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{detailedApprovalCode.approval_code.clinical_encounter}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* Band Information */}
                  {selectedApprovalCode.enrollee_bands && selectedApprovalCode.enrollee_bands.length > 0 && (
                    <div>
                      <h3 className="text-blue-600 font-semibold mb-4">Band Access Information</h3>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-red-400">Enrollee Plan</label>
                            <p className="text-sm font-semibold">{selectedApprovalCode.enrollee_plan || 'No Plan'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-red-400">Accessible Bands</label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {selectedApprovalCode.enrollee_bands.map((band, index) => (
                                <Badge key={index} className="bg-blue-100 text-blue-800">
                                  {band}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        {selectedApprovalCode.band_summary && (
                          <div className="mt-3">
                            <label className="text-sm font-medium text-red-400">Band Summary</label>
                            <p className="text-sm text-blue-800 mt-1">{selectedApprovalCode.band_summary.message}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Service Information */}
                  <div>
                    <h3 className="text-blue-600 font-semibold mb-4">Service Information</h3>

                    {isLoadingDetails ? (
                      <div className="text-center py-4 text-gray-500">Loading service details...</div>
                    ) : (
                      detailedApprovalCode?.approval_code?.service_items && detailedApprovalCode.approval_code.service_items.length > 0
                    ) || (
                      detailedApprovalCode?.approval_code?.rejected_initial_services && detailedApprovalCode.approval_code.rejected_initial_services.length > 0
                    ) || (
                      detailedApprovalCode?.approval_code?.rejected_added_services && detailedApprovalCode.approval_code.rejected_added_services.length > 0
                    ) ? (
                      <div className="space-y-3">
                        {/* Initial Services */}
                        {detailedApprovalCode.approval_code.initial_services && detailedApprovalCode.approval_code.initial_services.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Original Services</h4>
                            <div className="space-y-2">
                              {detailedApprovalCode.approval_code.initial_services.map((service: any, index: number) => (
                                <div key={service.id} className="flex justify-between items-center bg-green-50 border border-green-200 rounded-lg p-3">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">{service.service_name}</p>
                                    <p className="text-xs text-green-700">
                                      {service.quantity || 1} x ₦{parseFloat(service.service_amount).toLocaleString()} = ₦{((service.quantity || 1) * parseFloat(service.service_amount)).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Added: {new Date(service.added_at).toLocaleDateString()} {new Date(service.added_at).toLocaleTimeString()}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-green-700">₦{((service.quantity || 1) * parseFloat(service.service_amount)).toLocaleString()}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Rejected Original Services */}
                        {detailedApprovalCode.approval_code.rejected_initial_services && detailedApprovalCode.approval_code.rejected_initial_services.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-2">
                              <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">REJECTED</span>
                              Rejected Original Services
                            </h4>
                            <div className="space-y-2">
                              {detailedApprovalCode.approval_code.rejected_initial_services.map((service: any, index: number) => (
                                <div key={service.id || index} className="flex justify-between items-center bg-red-50 border border-red-200 rounded-lg p-3">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">{service.service_name}</p>
                                    <p className="text-xs text-red-700">
                                      {service.quantity || 1} x ₦{Number(service.service_amount || 0).toLocaleString()} = ₦{((service.quantity || 1) * Number(service.service_amount || 0)).toLocaleString()}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge className="bg-red-600 text-white text-xs">Rejected</Badge>
                                    </div>
                                    {service.rejection_reason && (
                                      <p className="text-xs text-red-600 mt-1">Reason: {service.rejection_reason}</p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-red-600 line-through">₦{((service.quantity || 1) * Number(service.service_amount || 0)).toLocaleString()}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Added Services — already approved by Call Centre, shown blue */}
                        {detailedApprovalCode.approval_code.added_services && detailedApprovalCode.approval_code.added_services.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-blue-700 mb-2 flex items-center gap-2">
                              <span className="bg-[#BE1522] text-white text-xs px-2 py-1 rounded">APPROVED</span>
                              Also Approved Services
                            </h4>
                            <div className="space-y-2">
                              {detailedApprovalCode.approval_code.added_services.map((service: any, index: number) => (
                                <div key={service.id} className="flex justify-between items-center bg-blue-50 border border-blue-200 rounded-lg p-3">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">{service.service_name}</p>
                                    <p className="text-xs text-blue-700">
                                      {service.quantity || 1} x ₦{parseFloat(service.service_amount).toLocaleString()} = ₦{((service.quantity || 1) * parseFloat(service.service_amount)).toLocaleString()}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge className="bg-[#BE1522] text-white text-xs">Also Approved</Badge>
                                      <p className="text-xs text-gray-500">
                                        {new Date(service.added_at).toLocaleDateString()} {new Date(service.added_at).toLocaleTimeString()}
                                      </p>
                                    </div>
                                    <p className="text-xs text-gray-600 mt-1">Added by: {service.added_by}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-blue-700">₦{((service.quantity || 1) * parseFloat(service.service_amount)).toLocaleString()}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Pending Services (for mixed primary + secondary requests) */}
                        {detailedApprovalCode.approval_code.pending_services && detailedApprovalCode.approval_code.pending_services.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-yellow-700 mb-2 flex items-center gap-2">
                              <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded">PENDING</span>
                              Secondary Services Awaiting Call Centre Approval
                            </h4>
                            <div className="space-y-2">
                              {detailedApprovalCode.approval_code.pending_services.map((service: any, index: number) => (
                                <div key={service.id} className="flex justify-between items-center bg-yellow-50 border-2 border-yellow-300 rounded-lg p-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-yellow-900">{service.service_name}</p>
                                      {service.is_primary ? (
                                        <Badge className="bg-green-100 text-green-800 text-xs">Primary</Badge>
                                      ) : (
                                        <Badge className="bg-gray-100 text-gray-700 text-xs">Secondary</Badge>
                                      )}
                                      {service.is_ad_hoc && (
                                        <Badge className="bg-blue-100 text-blue-800 text-xs">Ad-Hoc</Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-yellow-700">
                                      {service.quantity || 1} x ₦{Number(service.service_amount || 0).toLocaleString()} = ₦{((service.quantity || 1) * Number(service.service_amount || 0)).toLocaleString()}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge className="bg-yellow-500 text-white text-xs">Pending Approval</Badge>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-yellow-700">₦{((service.quantity || 1) * Number(service.service_amount || 0)).toLocaleString()}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Rejected Add-Service Items */}
                        {detailedApprovalCode.approval_code.rejected_added_services && detailedApprovalCode.approval_code.rejected_added_services.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-2">
                              <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">REJECTED</span>
                              Rejected Add-Service Request
                            </h4>
                            {detailedApprovalCode.approval_code.rejected_add_reason && (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
                                <p className="text-xs font-medium text-red-800">Rejection Reason:</p>
                                <p className="text-xs text-red-700 mt-0.5">{detailedApprovalCode.approval_code.rejected_add_reason}</p>
                              </div>
                            )}
                            <div className="space-y-2">
                              {detailedApprovalCode.approval_code.rejected_added_services.map((service: any, index: number) => (
                                <div key={service.id || index} className="flex justify-between items-center bg-red-50 border-2 border-red-200 rounded-lg p-3">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">{service.service_name}</p>
                                    <p className="text-xs text-red-700">
                                      {service.quantity || 1} x ₦{Number(service.service_amount || 0).toLocaleString()} = ₦{((service.quantity || 1) * Number(service.service_amount || 0)).toLocaleString()}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge className="bg-red-600 text-white text-xs">Rejected</Badge>
                                    </div>
                                    {service.rejection_reason && (
                                      <p className="text-xs text-red-600 mt-1">Reason: {service.rejection_reason}</p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-red-600 line-through">₦{((service.quantity || 1) * Number(service.service_amount || 0)).toLocaleString()}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Total Summary */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                          {(() => {
                            const approvedCount = detailedApprovalCode.approval_code.service_items.length
                            const pendingCount = detailedApprovalCode.approval_code.pending_services?.length || 0
                            const totalCount = approvedCount + pendingCount
                            return (
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm text-gray-600">Total Services</p>
                              <p className="text-lg font-semibold text-gray-900">
                                {totalCount} service(s)
                              </p>
                              {pendingCount > 0 && (
                                <p className="text-xs text-yellow-700 mt-1">
                                  {approvedCount} approved, {pendingCount} pending
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-600">Total Amount</p>
                              <p className="text-2xl font-bold text-blue-600">
                                ₦{parseFloat(detailedApprovalCode.approval_code.amount).toLocaleString()}
                              </p>
                            </div>
                          </div>
                            )
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Services: {formatServices(selectedApprovalCode.services)}</p>
                        <p className="text-sm text-gray-500 mt-2">No detailed service breakdown available</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Date Generated</label>
                        <p className="text-sm">{new Date(selectedApprovalCode.date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Claim ID</label>
                        <p className="text-sm">{selectedApprovalCode.claim_id || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Service Breakdown for Partial/Rejected Approvals */}
                  {(effectiveSelectedStatus === 'PARTIAL' || effectiveSelectedStatus === 'REJECTED') && (
                    <div>
                      <h3 className="text-orange-600 font-semibold mb-4">Service Breakdown</h3>
                      <div className="space-y-4">
                        {/* Approved Services */}
                        <div>
                          <h4 className="text-green-600 font-medium mb-2">✅ Approved Services</h4>
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            {(() => {
                              try {
                                const allServices = getAllServicesForBreakdown()
                                if (Array.isArray(allServices) && allServices.length > 0) {
                                  // For fully rejected codes, never display any service as approved.
                                  const approvedServices = effectiveSelectedStatus === 'REJECTED'
                                    ? []
                                    : allServices.filter((service: any) =>
                                      (isApprovedCoverage(service) || service.is_approved === true) &&
                                      !isRejectedCoverage(service) &&
                                      service.is_approved !== false
                                    )
                                  if (approvedServices.length === 0) {
                                    return <p className="text-sm text-gray-500">No approved services</p>
                                  }
                                  return approvedServices.map((service: any, index: number) => (
                                    <div key={index} className="mb-2 last:mb-0">
                                      <div className="flex justify-between items-center">
                                        <span className="font-medium">{service.service_name}</span>
                                        <span className="text-green-600 font-semibold">₦{service.amount?.toLocaleString() || '0'}</span>
                                      </div>
                                      <div className={`text-sm ${isRejectedCoverage(service) ? 'text-red-600' : 'text-gray-600'}`}>
                                        Status: {isRejectedCoverage(service)
                                          ? 'Rejected'
                                          : service.coverage === 'COVERED'
                                            ? 'Covered'
                                            : service.coverage === 'EXCEEDED'
                                              ? 'Exceeded'
                                              : service.coverage}
                                      </div>
                                      {service.remarks && (
                                        <div className="text-sm text-gray-500 mt-1">
                                          Remarks: {service.remarks}
                                        </div>
                                      )}
                                    </div>
                                  ))
                                }
                                return <p className="text-sm">No approved services found</p>
                              } catch (error) {
                                return <p className="text-sm">Unable to parse services</p>
                              }
                            })()}
                          </div>
                        </div>

                        {/* Rejected Services */}
                        <div>
                          <h4 className="text-red-600 font-medium mb-2">❌ Rejected Services</h4>
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            {(() => {
                              try {
                                const allServices = getAllServicesForBreakdown()
                                if (Array.isArray(allServices) && allServices.length > 0) {
                                  // For fully rejected codes, all services should appear in rejected bucket.
                                  const rejectedServices = effectiveSelectedStatus === 'REJECTED'
                                    ? allServices
                                    : allServices.filter((service: any) =>
                                      isRejectedCoverage(service) || service.is_approved === false
                                    )
                                  if (rejectedServices.length === 0) {
                                    return <p className="text-sm text-gray-500">No rejected services</p>
                                  }
                                  return rejectedServices.map((service: any, index: number) => (
                                    <div key={index} className="mb-2 last:mb-0">
                                      <div className="flex justify-between items-center">
                                        <span className="font-medium">{service.service_name}</span>
                                        <span className="text-red-600 font-semibold">₦{service.amount?.toLocaleString() || '0'}</span>
                                      </div>
                                      <div className="text-sm text-red-600">
                                        Status: Rejected
                                      </div>
                                      {(service.remarks || service.rejection_reason) && (
                                        <div className="text-sm text-red-700 mt-1 font-medium">
                                          Rejection Reason: {service.rejection_reason || service.remarks}
                                        </div>
                                      )}
                                    </div>
                                  ))
                                }
                                return <p className="text-sm">No rejected services found</p>
                              } catch (error) {
                                return <p className="text-sm">Unable to parse services</p>
                              }
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rejection Information */}
                  {effectiveSelectedStatus === 'REJECTED' && effectiveSelectedRejectionReason && (
                    <div>
                      <h3 className="text-red-600 font-semibold mb-4">Rejection Information</h3>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <label className="text-sm font-medium text-red-600">Rejection Reason</label>
                        <p className="text-sm text-red-800 mt-1">{effectiveSelectedRejectionReason}</p>
                      </div>
                    </div>
                  )}

                  {/* Partial Approval Information */}
                  {effectiveSelectedStatus === 'PARTIAL' && (
                    <div>
                      <h3 className="text-orange-600 font-semibold mb-4">Partial Approval Information</h3>
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <p className="text-sm text-orange-800">
                          This request was partially approved. Some services were approved and others were rejected.
                          Only the approved services are included in this approval code.
                        </p>
                      </div>
                    </div>
                  )}

                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add Service Modal */}
        <Dialog open={showAddServiceModal} onOpenChange={setShowAddServiceModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Services to Approval Code</DialogTitle>
              <DialogDescription>
                Search and add more services to the approval code: {selectedApprovalCode?.approval_code}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Enrollee Info Summary */}
              <div className="bg-blue-50 p-3 rounded-lg flex justify-between items-center text-sm">
                <div>
                  <p className="font-semibold text-blue-900">{selectedApprovalCode?.enrollee?.first_name} {selectedApprovalCode?.enrollee?.last_name}</p>
                  <p className="text-blue-700">{selectedApprovalCode?.enrollee?.enrollee_id}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-blue-900">{selectedApprovalCode?.hospital}</p>
                </div>
              </div>

              {!selectedApprovalCode || isWithinAddServiceWindow(selectedApprovalCode) ? (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Service Search */}
                    <div className="relative">
                      <Label>Search Medical Services</Label>
                      <div className="relative mt-1">
                        <Input
                          placeholder="Search medical services..."
                          value={serviceSearchTerm}
                          onChange={(e) => {
                            setServiceSearchTerm(e.target.value)
                            setShowServiceResults(true)
                          }}
                          onFocus={() => setShowServiceResults(true)}
                        />
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      </div>

                      {showServiceResults && serviceSearchTerm.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {isLoadingServices ? (
                            <div className="p-4 text-center text-sm text-gray-500">Loading services...</div>
                          ) : filteredMedicalServices.length > 0 ? (
                            filteredMedicalServices.map((service: any) => (
                              <div
                                key={service.service_id || service.id}
                                className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 flex justify-between items-center"
                                onClick={() => {
                                  const selectedId = service.service_id || service.id
                                  if (!addingServices.find(s => s.id === selectedId)) {
                                    setAddingServices(prev => [...prev, {
                                      id: selectedId,
                                      service_id: selectedId,
                                      name: service.service_name || service.name,
                                      amount: service.price || 0,
                                      quantity: 1,
                                      unitPrice: Number(service.price || 0),
                                      is_ad_hoc: false,
                                      category_id: "SER",
                                      service_category: service.category_name || "Medical Services",
                                      service_type: service.service_type ?? null
                                    }])
                                  }
                                  setShowServiceResults(false)
                                  setServiceSearchTerm("")
                                }}
                              >
                                <div>
                                  <div className="font-medium text-gray-900">{service.service_name || service.name}</div>
                                  <div className="text-xs text-gray-500">{service.category_name}</div>
                                </div>
                                <div className="font-semibold text-blue-600">₦{Number(service.price || 0).toLocaleString()}</div>
                              </div>
                            ))
                          ) : (
                            <div className="p-4 text-center text-sm text-gray-500">No services found</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Drug Search */}
                    <div className="relative">
                      <Label>Search Drugs / Pharmaceuticals</Label>
                      <div className="relative mt-1">
                        <Input
                          placeholder="Search drugs..."
                          value={drugSearchTerm}
                          onChange={(e) => {
                            setDrugSearchTerm(e.target.value)
                            setShowDrugResults(true)
                          }}
                          onFocus={() => setShowDrugResults(true)}
                        />
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      </div>

                      {showDrugResults && drugSearchTerm.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {isLoadingServices ? (
                            <div className="p-4 text-center text-sm text-gray-500">Loading drugs...</div>
                          ) : filteredDrugServices.length > 0 ? (
                            filteredDrugServices.map((service: any) => (
                              <div
                                key={service.service_id || service.id}
                                className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 flex justify-between items-center"
                                onClick={() => {
                                  const selectedId = service.service_id || service.id
                                  if (!addingServices.find(s => s.id === selectedId)) {
                                    setAddingServices(prev => [...prev, {
                                      id: selectedId,
                                      service_id: selectedId,
                                      name: service.service_name || service.name,
                                      amount: service.price || 0,
                                      quantity: 1,
                                      unitPrice: Number(service.price || 0),
                                      is_ad_hoc: false,
                                      category_id: "DRG",
                                      service_category: service.category_name || "Drugs / Pharmaceuticals",
                                      service_type: service.service_type ?? null
                                    }])
                                  }
                                  setShowDrugResults(false)
                                  setDrugSearchTerm("")
                                }}
                              >
                                <div>
                                  <div className="font-medium text-gray-900">{service.service_name || service.name}</div>
                                  <div className="text-xs text-gray-500">{service.category_name}</div>
                                </div>
                                <div className="font-semibold text-green-600">₦{Number(service.price || 0).toLocaleString()}</div>
                              </div>
                            ))
                          ) : (
                            <div className="p-4 text-center text-sm text-gray-500">No drugs found</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ad-hoc Service Entry */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                    <div>
                      <Label className="text-blue-900 font-medium">Add Ad-Hoc Service / Drug</Label>
                      <p className="text-xs text-blue-700">Not in tariff list? Add as ad-hoc and it will be sent to Call Centre for approval.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <Select value={adHocType} onValueChange={(value) => setAdHocType(value as "SERVICE" | "DRUG")}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SERVICE">Medical Service</SelectItem>
                          <SelectItem value="DRUG">Drug</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder={adHocType === "DRUG" ? "Drug name" : "Service name"}
                        value={adHocServiceName}
                        onChange={(e) => setAdHocServiceName(e.target.value)}
                        className="md:col-span-2 bg-white"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Unit price"
                        value={adHocServicePrice}
                        onChange={(e) => setAdHocServicePrice(e.target.value)}
                        className="bg-white"
                      />
                      <Input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={adHocServiceQuantity}
                        onChange={(e) => setAdHocServiceQuantity(e.target.value)}
                        className="bg-white"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-blue-300 text-blue-700 hover:bg-blue-100"
                        onClick={() => {
                          const name = adHocServiceName.trim()
                          const unitPrice = Number(adHocServicePrice) || 0
                          const quantity = Math.max(1, Number(adHocServiceQuantity) || 1)
                          if (!name) {
                            toast({ title: "Error", description: "Enter ad-hoc name", variant: "destructive" })
                            return
                          }
                          if (unitPrice <= 0) {
                            toast({ title: "Error", description: "Enter a valid unit price", variant: "destructive" })
                            return
                          }
                          setAddingServices(prev => [
                            ...prev,
                            {
                              id: `adhoc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                              service_id: null,
                              name,
                              unitPrice,
                              quantity,
                              is_ad_hoc: true,
                              category_id: adHocType === "DRUG" ? "DRG" : "SER",
                              service_category: adHocType === "DRUG" ? "Drugs / Pharmaceuticals" : "Medical Services",
                              service_type: null
                            }
                          ])
                          setAdHocServiceName("")
                          setAdHocServicePrice("")
                          setAdHocServiceQuantity("1")
                          setAdHocType("SERVICE")
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Ad-Hoc
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  Add Service is disabled because this approval code is older than 24 hours.
                </div>
              )}

              {/* Selected Services for Adding */}
              {addingServices.length > 0 && (
                <div className="space-y-3">
                  <Label>Services to Add</Label>
                  <div className="border rounded-lg divide-y bg-gray-50 max-h-48 overflow-y-auto">
                    {addingServices.map((service) => (
                      <div key={service.id} className="p-3 flex justify-between items-center bg-white">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{service.name}</p>
                            {(service.category_id === "DRG" || String(service.service_category || "").toLowerCase().includes("drug")) ? (
                              <Badge className="bg-green-100 text-green-800 text-xs">Drug</Badge>
                            ) : (
                              <Badge className="bg-blue-100 text-blue-800 text-xs">Service</Badge>
                            )}
                            {service.service_type === 1 ? (
                              <Badge className="bg-emerald-100 text-emerald-700 text-xs">Primary</Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-700 text-xs">Secondary</Badge>
                            )}
                            {service.is_ad_hoc && (
                              <Badge className="bg-blue-100 text-blue-800 text-xs">Ad-Hoc</Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">₦{service.unitPrice.toLocaleString()} per unit</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs">Qty:</Label>
                            <Input
                              type="number"
                              min="1"
                              className="h-7 w-16 text-right px-1"
                              value={service.quantity === 0 ? '' : service.quantity}
                              onChange={(e) => {
                                const val = e.target.value
                                setAddingServices(prev => prev.map(s => {
                                  if (s.id === service.id) {
                                    const numQty = parseInt(val)
                                    const validQty = isNaN(numQty) ? 0 : numQty
                                    return { ...s, quantity: val as any, amount: s.unitPrice * validQty }
                                  }
                                  return s
                                }))
                              }}
                            />
                          </div>
                          <p className="font-semibold text-sm w-24 text-right">
                            ₦{(service.unitPrice * (isNaN(parseInt(service.quantity)) ? 0 : parseInt(service.quantity))).toLocaleString()}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 h-7 w-7 p-0"
                            onClick={() => setAddingServices(prev => prev.filter(s => s.id !== service.id))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t font-bold">
                    <span>Total to Add:</span>
                    <span className="text-lg text-blue-600">
                      ₦{addingServices.reduce((sum, s) => sum + (s.unitPrice * (isNaN(parseInt(s.quantity)) ? 0 : parseInt(s.quantity))), 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="add-service-diagnosis">Diagnosis</Label>
                <Textarea
                  id="add-service-diagnosis"
                  placeholder="Add or update the diagnosis for this request..."
                  value={addServiceDiagnosis}
                  onChange={(e) => setAddServiceDiagnosis(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-service-comment">Comment for Call Centre *</Label>
                <Textarea
                  id="add-service-comment"
                  placeholder="State why these extra services are being requested..."
                  value={addServiceComment}
                  onChange={(e) => setAddServiceComment(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowAddServiceModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedApprovalCode && !isWithinAddServiceWindow(selectedApprovalCode)) {
                    toast({ title: "Window Expired", description: "Add service is only available within 24 hours of approval.", variant: "destructive" })
                    return
                  }
                  if (addingServices.length === 0) {
                    toast({ title: "Error", description: "Please select at least one service", variant: "destructive" })
                    return
                  }
                  if (!addServiceComment.trim()) {
                    toast({ title: "Error", description: "Comment is required before submitting", variant: "destructive" })
                    return
                  }
                  addServiceMutation.mutate({
                    diagnosis: addServiceDiagnosis.trim(),
                    comment: addServiceComment.trim(),
                    services: addingServices.map(s => ({
                      service_id: s.is_ad_hoc ? null : s.id,
                      service_name: s.name,
                      service_amount: s.unitPrice,
                      quantity: Math.max(1, isNaN(parseInt(s.quantity)) ? 1 : parseInt(s.quantity)),
                      unit_price: s.unitPrice,
                      is_ad_hoc: s.is_ad_hoc === true,
                      category_id: s.category_id || "SER",
                      service_category: s.service_category || (s.category_id === "DRG" ? "Drugs / Pharmaceuticals" : "Medical Services"),
                      service_type: typeof s.service_type === "number" ? s.service_type : null
                    }))
                  })
                }}
                disabled={addingServices.length === 0 || !addServiceComment.trim() || addServiceMutation.isPending}
                className="bg-[#BE1522] hover:bg-[#9B1219]"
              >
                {addServiceMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit for Approval
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </PermissionGate>
  )
}
