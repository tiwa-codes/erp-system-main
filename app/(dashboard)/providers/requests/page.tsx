"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { AuditTrailView } from "@/components/claims/AuditTrailView"
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
  Plus,
  ShoppingBag,
  Bell,
  Flag,
  X,
  MoreHorizontal,
  Loader2
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { formatLongCountdown } from "@/lib/claims-request-window"



interface ClaimRequest {
  id: string
  approval_code?: string
  enrollee_id: string
  enrollee_name: string
  services: string
  amount: number
  status: string | null
  raw_status?: string | null
  date: string | null
  rejection_reason?: string | null
  provider_id: string
  provider: {
    id: string
    facility_name: string
    facility_type: string
  }
  requested_by?: string
}

interface ClaimsRequestMetrics {
  approved_services: number
  rejected_services: number
  new_services: number
  pending_services: number
  paid_services: number
}

interface ClaimsRequestWindow {
  status: "BEFORE_WINDOW" | "OPEN" | "AFTER_WINDOW"
  is_open: boolean
  time_zone: string
  open_at: string
  close_at: string
  close_at_exclusive: string
  next_open_at: string
  countdown_target: string
  remaining_seconds: number
}

interface RejectedServiceDetail {
  service_name?: string
  quantity?: number
  service_amount?: number
  unit_amount?: number
  rejection_reason?: string
  coverage?: string
}

interface ParsedRejectionReason {
  overall_remarks?: string
  rejection_date?: string
  rejected_count?: number
  rejected_services: RejectedServiceDetail[]
}

export default function ClaimsRequestPage() {

  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedProvider, setSelectedProvider] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)
  const [selectedClaims, setSelectedClaims] = useState<string[]>([])
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<ClaimRequest | null>(null)
  const [showAuditLogModal, setShowAuditLogModal] = useState(false)
  const [selectedClaimForAudit, setSelectedClaimForAudit] = useState<ClaimRequest | null>(null)
  const [expandedServicesByClaim, setExpandedServicesByClaim] = useState<Record<string, boolean>>({})
  const [nowTickMs, setNowTickMs] = useState(Date.now())

  // Add Service modal state
  const [showAddServiceModal, setShowAddServiceModal] = useState(false)
  const [selectedRequestForAddService, setSelectedRequestForAddService] = useState<ClaimRequest | null>(null)
  const [serviceSearchTerm, setServiceSearchTerm] = useState("")
  const [selectedServices, setSelectedServices] = useState<any[]>([])
  const [isLoadingServices, setIsLoadingServices] = useState(false)
  const [availableServices, setAvailableServices] = useState<any[]>([])

  // Ad-hoc service state
  const [showAdHocInput, setShowAdHocInput] = useState(false)
  const [adHocServiceName, setAdHocServiceName] = useState("")
  const [adHocServicePrice, setAdHocServicePrice] = useState("")
  const [adHocServiceQuantity, setAdHocServiceQuantity] = useState("1")

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Reset pagination when filters change (after debounce for search)
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, selectedStatus, selectedProvider, startDate, endDate])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTickMs(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  // Fetch provider requests
  const { data: requestsData, isLoading, isFetching, error } = useQuery({
    queryKey: ["claims-requests", currentPage, limit, debouncedSearchTerm, selectedStatus, selectedProvider, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(selectedProvider !== "all" && { provider: selectedProvider }),
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
      })

      const res = await fetch(`/api/claims/requests?${params}`)
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error("Failed to fetch Provider Requests")
      }

      const jsonData = await res.json()
      return jsonData
    },
    placeholderData: (previousData) => previousData,
  })

  // Fetch providers for filter
  const { data: providersData } = useQuery({
    queryKey: ["claims-request-providers"],
    queryFn: async () => {
      const res = await fetch("/api/providers?page=1&limit=5000")
      if (!res.ok) {
        throw new Error("Failed to fetch providers")
      }
      return res.json()
    },
  })

  const providerOptions = useMemo(() => {
    const providers = (providersData?.providers || [])
      .slice()
      .sort((a: any, b: any) => a.facility_name.localeCompare(b.facility_name))

    return [
      { value: "all", label: "All Providers" },
      ...providers.map((p: any) => ({ value: p.id, label: p.facility_name })),
    ]
  }, [providersData])

  // Fetch metrics
  const { data: metricsData } = useQuery({
    queryKey: ["claims-requests-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/claims/requests/metrics")
      if (!res.ok) {
        throw new Error("Failed to fetch metrics")
      }
      return res.json()
    },
  })

  const { data: claimsRequestWindowData } = useQuery<ClaimsRequestWindow>({
    queryKey: ["claims-request-window"],
    queryFn: async () => {
      const res = await fetch("/api/claims/requests/window")
      if (!res.ok) {
        throw new Error("Failed to fetch claims request window")
      }
      return res.json()
    },
    refetchInterval: 60000,
  })

  const requests = requestsData?.requests || []
  const pagination = requestsData?.pagination
  const metrics = metricsData?.metrics || {
    approved_services: 0,
    rejected_services: 0,
    new_services: 0,
    pending_services: 0,
    paid_services: 0,
  }

  const claimsWindowCountdownTarget = claimsRequestWindowData?.countdown_target
    ? new Date(claimsRequestWindowData.countdown_target).getTime()
    : null
  const claimsWindowRemainingSeconds = claimsWindowCountdownTarget
    ? Math.max(0, Math.floor((claimsWindowCountdownTarget - nowTickMs) / 1000))
    : (claimsRequestWindowData?.remaining_seconds || 0)
  const canRequestClaimsNow = Boolean(claimsRequestWindowData?.is_open)
  const claimsWindowCountdownText = formatLongCountdown(claimsWindowRemainingSeconds)
  const formatWindowDateTime = (value?: string | null) => {
    if (!value) return "-"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "-"
    return date.toLocaleString("en-GB", {
      timeZone: claimsRequestWindowData?.time_zone || "Africa/Lagos",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  }
  const claimsWindowLabel = canRequestClaimsNow
    ? `Claims request window is OPEN. Time left: ${claimsWindowCountdownText}`
    : `Claims request window is CLOSED. Opens in: ${claimsWindowCountdownText}`
  const claimsWindowSubLabel = canRequestClaimsNow
    ? `Window closes on ${formatWindowDateTime(claimsRequestWindowData?.close_at)} WAT`
    : `Next window opens on ${formatWindowDateTime(claimsRequestWindowData?.next_open_at)} WAT`
  const requestClaimMenuLabel = canRequestClaimsNow
    ? `Request Claim (${claimsWindowCountdownText} left)`
    : `Request Claim (Opens in ${claimsWindowCountdownText})`


  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setSearchTerm("")
    setSelectedStatus("all")
    setSelectedProvider("all")
    setStartDate("")
    setEndDate("")
    setCurrentPage(1)
  }

  // Handle export
  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(selectedProvider !== "all" && { provider: selectedProvider }),
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
      })

      const res = await fetch(`/api/claims/requests/export?${params}`)
      if (!res.ok) {
        throw new Error("Failed to export claims requests")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `claims-requests-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Success",
        description: "Claims requests exported successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export claims requests",
        variant: "destructive",
      })
    }
  }

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    const selectableClaimIds = safeRequests
      .filter((request: ClaimRequest) => request.raw_status === "NEW")
      .map((request: ClaimRequest) => request.id)

    if (checked) {
      setSelectedClaims(selectableClaimIds)
    } else {
      setSelectedClaims([])
    }
  }

  // Handle individual select
  const handleSelectClaim = (claimId: string, checked: boolean) => {
    if (checked) {
      setSelectedClaims([...selectedClaims, claimId])
    } else {
      setSelectedClaims(selectedClaims.filter(id => id !== claimId))
    }
  }

  // Add Service handlers
  const handleAddServiceToSelected = (service: any) => {
    const exists = selectedServices.find(s => s.id === service.id)
    if (!exists) {
      setSelectedServices([...selectedServices, { ...service, quantity: 1 }])
    }
  }

  const handleRemoveServiceFromSelected = (serviceId: string) => {
    setSelectedServices(selectedServices.filter(s => s.id !== serviceId))
  }

  const handleUpdateServiceQuantity = (serviceId: string, quantity: number) => {
    setSelectedServices(selectedServices.map(s =>
      s.id === serviceId ? { ...s, quantity } : s
    ))
  }

  const handleAddAdHocService = () => {
    if (!adHocServiceName || !adHocServicePrice) {
      toast({
        title: "Error",
        description: "Please enter service name and price",
        variant: "destructive",
      })
      return
    }

    const adHocService = {
      id: `adhoc-${Date.now()}`,
      service_name: adHocServiceName,
      service_amount: parseFloat(adHocServicePrice),
      tariff_price: 0,
      quantity: parseInt(adHocServiceQuantity) || 1,
      is_ad_hoc: true,
    }

    setSelectedServices([...selectedServices, adHocService])
    setAdHocServiceName("")
    setAdHocServicePrice("")
    setAdHocServiceQuantity("1")
    setShowAdHocInput(false)
  }

  // Submit added services mutation
  const submitAddedServicesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRequestForAddService?.approval_code) {
        throw new Error("No approval code found")
      }

      const services = selectedServices.map(s => ({
        service_name: s.service_name,
        service_amount: s.service_amount || s.tariff_price,
        quantity: s.quantity,
        is_ad_hoc: s.is_ad_hoc || false,
        tariff_price: s.tariff_price,
      }))

      const res = await fetch(
        `/api/provider/approval-codes/${selectedRequestForAddService.approval_code}/add-services`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ services }),
        }
      )

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to add services")
      }

      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Services added successfully and sent for approval",
      })
      setShowAddServiceModal(false)
      setSelectedServices([])
      setSelectedRequestForAddService(null)
      queryClient.invalidateQueries({ queryKey: ["claims-requests"] })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add services",
        variant: "destructive",
      })
    },
  })

  // Request Claim
  const requestAllClaimsMutation = useMutation({
    mutationFn: async (claimIds?: string[]) => {
      const idsToRequest = claimIds && claimIds.length > 0 ? claimIds : selectedClaims
      const requestData = { claim_ids: idsToRequest }

      const res = await fetch('/api/claims/requests/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })

      if (!res.ok) {
        const errorData = await res.json()
        console.error('API Error:', errorData)
        throw new Error(`Failed to Request Claim: ${errorData.error || 'Unknown error'}`)
      }
      return res.json()
    },
    onSuccess: async (data) => {
      toast({
        title: "Success",
        description: `${data.processed_claims} claims sent to Vetter 1 successfully`,
      })
      // Invalidate multiple query keys to refresh all related pages
      queryClient.invalidateQueries({ queryKey: ["claims-requests"] })
      queryClient.invalidateQueries({ queryKey: ["vetter1-claims"] }) // ✅ Refresh Vetter1 page
      queryClient.invalidateQueries({ queryKey: ["provider-requests"] }) // ✅ Refresh provider requests list
      queryClient.invalidateQueries({ queryKey: ["vetter1-metrics"] }) // ✅ Refresh Vetter1 metrics

      // Force refetch of critical queries to ensure immediate update
      await queryClient.refetchQueries({ queryKey: ["vetter1-claims"] })
      await queryClient.refetchQueries({ queryKey: ["vetter1-metrics"] })
      setSelectedClaims([])
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to Request Claim",
        variant: "destructive",
      })
    },
  })

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

  const truncateServices = (text: string, maxLength = 80) => {
    if (!text) return "-"
    if (text.length <= maxLength) return text
    return `${text.slice(0, maxLength)}...`
  }

  // Get status badge color
  const getStatusBadgeColor = (status?: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-800'

    switch (status.toUpperCase()) {
      case 'NEW':
        return 'bg-blue-100 text-blue-800'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'APPROVED':
        return 'bg-green-100 text-green-800'
      case 'PARTIAL':
        return 'bg-orange-100 text-orange-800'
      case 'REJECTED':
        return 'bg-red-100 text-red-800'
      case 'DELETED':
        return 'bg-red-100 text-red-800'
      case 'PAID':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const safeRequests: ClaimRequest[] = Array.isArray(requests) ? requests : []

  const getStatusLabel = (status?: string | null) => {
    if (!status) return "Pending"
    const normalized = String(status)
    return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase()
  }

  const formatDate = (value?: string | null) => {
    if (!value) return "-"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "-"
    return date.toLocaleDateString('en-GB')
  }

  const parseRejectionReason = (reason?: string | null): ParsedRejectionReason | null => {
    if (!reason || typeof reason !== "string") return null

    const trimmedReason = reason.trim()
    if (!trimmedReason.startsWith("{") && !trimmedReason.startsWith("[")) {
      return null
    }

    try {
      const parsed = JSON.parse(trimmedReason)
      if (!parsed || typeof parsed !== "object") return null

      const rejectedServicesRaw = Array.isArray((parsed as any).rejected_services)
        ? (parsed as any).rejected_services
        : []

      const rejectedServices: RejectedServiceDetail[] = rejectedServicesRaw.map((service: any) => ({
        service_name: service?.service_name || service?.name || "Service",
        quantity: Number(service?.quantity) || undefined,
        service_amount: Number(service?.service_amount) || undefined,
        unit_amount: Number(service?.unit_amount) || undefined,
        rejection_reason: service?.rejection_reason || service?.remarks || undefined,
        coverage: service?.coverage || undefined,
      }))

      if (
        rejectedServices.length === 0 &&
        !(parsed as any).overall_remarks &&
        !(parsed as any).rejection_date &&
        !(parsed as any).rejected_count
      ) {
        return null
      }

      return {
        overall_remarks: (parsed as any).overall_remarks || undefined,
        rejection_date: (parsed as any).rejection_date || undefined,
        rejected_count: Number((parsed as any).rejected_count) || rejectedServices.length,
        rejected_services: rejectedServices,
      }
    } catch {
      return null
    }
  }

  return (
    <PermissionGate module="provider" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Claims Request</h1>
            <p className="text-gray-600">Manage and process claims requests</p>
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Approved</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.approved_services}</p>
                  <p className="text-sm text-emerald-600">Approved claims</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <ShoppingBag className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.pending_services}</p>
                  <p className="text-sm text-yellow-600">In process</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Claims Paid</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.paid_services}</p>
                  <p className="text-sm text-green-600">Settlement completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Bell className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">New</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.new_services}</p>
                  <p className="text-sm text-blue-600">Ready for vetting</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Rejected</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.rejected_services}</p>
                  <p className="text-sm text-red-600">Rejected claims</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Request Claim</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <PermissionGate module="provider" action="add">
                  <Button
                    onClick={() => requestAllClaimsMutation.mutate(undefined)}
                    disabled={selectedClaims.length === 0 || requestAllClaimsMutation.isPending || !canRequestClaimsNow}
                    className="bg-[#0891B2] hover:bg-[#9B1219]"
                  >
                    Request Claim
                  </Button>
                </PermissionGate>
              </div>
            </div>
            <div className={`mt-3 text-sm ${canRequestClaimsNow ? "text-green-700" : "text-amber-700"}`}>
              {claimsWindowLabel}
            </div>
            <div className="mt-1 text-xs text-gray-600">
              {claimsWindowSubLabel} • Request window is open from 1st to 7th every month
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  placeholder="Claim number, enrollee, provider, service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <Label>Provider</Label>
                <Combobox
                  options={providerOptions}
                  value={selectedProvider}
                  onValueChange={(value) => {
                    setSelectedProvider(value || "all")
                    handleFilterChange()
                  }}
                  placeholder="All Providers"
                  searchPlaceholder="Search provider..."
                  emptyText="No provider found"
                  clearable
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={selectedStatus}
                  onValueChange={(value) => {
                    setSelectedStatus(value)
                    handleFilterChange()
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="NEW">New</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="DELETED">Deleted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="start-date">From</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    handleFilterChange()
                  }}
                />
              </div>
              <div>
                <Label htmlFor="end-date">To</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    handleFilterChange()
                  }}
                />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Claims Request Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Claims Requests</CardTitle>
                <CardDescription>Manage claims requests and their status</CardDescription>
              </div>
              {isFetching && !isLoading && (
                <span className="inline-flex items-center text-xs text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  Updating table...
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Checkbox
                          checked={
                            safeRequests.filter((request: ClaimRequest) => request.raw_status === "NEW").length > 0 &&
                            selectedClaims.length === safeRequests.filter((request: ClaimRequest) => request.raw_status === "NEW").length
                          }
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">APPROVAL CODE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ENROLLEE ID</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ENROLLEE NAME</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PROVIDER</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">SERVICES</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeRequests.map((request: ClaimRequest) => {
                      const isDeleted = (request.raw_status || request.status || "").toUpperCase() === "DELETED"
                      return (
                      <TableRow key={request.id} className={isDeleted ? "bg-red-50/40 text-red-900" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={selectedClaims.includes(request.id)}
                            onCheckedChange={(checked) => handleSelectClaim(request.id, checked as boolean)}
                            disabled={request.raw_status !== "NEW" || isDeleted}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {request.approval_code || '-'}
                        </TableCell>
                        <TableCell>
                          {request.enrollee_id}
                        </TableCell>
                        <TableCell>
                          {request.enrollee_name}
                        </TableCell>
                        <TableCell>
                          {request.provider?.facility_name || '-'}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const fullServicesText = formatServices(request.services)
                            const isExpanded = Boolean(expandedServicesByClaim[request.id])
                            const isLong = fullServicesText.length > 80
                            return (
                              <div className="max-w-[280px]">
                                <div className="break-words text-sm">
                                  {isExpanded ? fullServicesText : truncateServices(fullServicesText)}
                                </div>
                                {isLong && (
                                  <button
                                    type="button"
                                    className="mt-1 text-xs text-blue-600 hover:underline"
                                    onClick={() =>
                                      setExpandedServicesByClaim((prev) => ({
                                        ...prev,
                                        [request.id]: !isExpanded
                                      }))
                                    }
                                  >
                                    {isExpanded ? "Collapse" : "View more"}
                                  </button>
                                )}
                              </div>
                            )
                          })()}
                        </TableCell>
                        <TableCell>
                          ₦{typeof request.amount === 'string' ?
                            (parseFloat(request.amount) || 0).toLocaleString() :
                            (request.amount || 0).toLocaleString()
                          }
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(request.status)}>
                            {getStatusLabel(request.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatDate(request.date)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedClaim(request)
                                  setShowClaimModal(true)
                                }}
                                className="w-full justify-start text-xs"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {!isDeleted && request.approval_code && request.raw_status === 'APPROVED' && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedRequestForAddService(request)
                                    setShowAddServiceModal(true)
                                  }}
                                  className="w-full justify-start text-xs"
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Service
                                </DropdownMenuItem>
                              )}
                              {!isDeleted && request.raw_status === 'NEW' && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (!canRequestClaimsNow) return
                                    requestAllClaimsMutation.mutate([request.id])
                                  }}
                                  disabled={!canRequestClaimsNow || requestAllClaimsMutation.isPending}
                                  className="w-full justify-start text-xs"
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  {requestClaimMenuLabel}
                                </DropdownMenuItem>
                              )}
                              {!isDeleted && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedClaimForAudit(request)
                                    setShowAuditLogModal(true)
                                  }}
                                  className="w-full justify-start text-xs"
                                >
                                  <Clock className="h-4 w-4 mr-2" />
                                  Audit Log
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {pagination && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-600">
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={pagination.page === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {pagination.page} of {pagination.pages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.pages))}
                        disabled={pagination.page === pagination.pages}
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

        {/* Claim Details Modal */}
        {showClaimModal && selectedClaim && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-blue-600">Claim Details</h2>
                  <p className="text-blue-600">Claim Details {'>>'} {selectedClaim.enrollee_name}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowClaimModal(false)
                    setSelectedClaim(null)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Claim Details Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-blue-600 mb-4">Claim Details</h3>
                <div className="grid grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Approval Code</label>
                      <p className="text-lg font-semibold">{selectedClaim.approval_code || 'APR/2025/07/23'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Date of Claim</label>
                      <p className="text-lg">{formatDate(selectedClaim.date)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Service Type</label>
                      <div className="text-lg">
                        {(() => {
                          try {
                            const services = typeof selectedClaim.services === 'string'
                              ? JSON.parse(selectedClaim.services)
                              : selectedClaim.services;

                            if (Array.isArray(services)) {
                              return services.map((service: any, index: number) => (
                                <div key={index} className="mb-1">
                                  <Badge variant="outline" className={`text-xs ${service.price_modified_by_call_centre ? 'border-orange-400 bg-orange-50 text-orange-800' : ''}`}>
                                    {service.service_name || service.name || service}
                                    {service.price_modified_by_call_centre && ' ⚠'}
                                  </Badge>
                                </div>
                              ));
                            } else if (typeof services === 'object' && services !== null) {
                              return <Badge variant="outline" className="text-xs">
                                {services.service_name || services.name || 'Service'}
                              </Badge>;
                            } else {
                              return <span>{services || 'Consultation'}</span>;
                            }
                          } catch (error) {
                            return <span>{selectedClaim.services || 'Consultation'}</span>;
                          }
                        })()}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Amount</label>
                      <p className="text-lg font-semibold text-green-600">₦{selectedClaim.amount?.toLocaleString() || '4,000'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Status</label>
                      <p className="text-lg text-gray-900">
                        {getStatusLabel(selectedClaim.status)}
                      </p>
                    </div>
                    {selectedClaim.rejection_reason && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Rejection Comment</label>
                        {(() => {
                          const parsedRejection = parseRejectionReason(selectedClaim.rejection_reason)

                          if (!parsedRejection) {
                            return (
                              <p className="text-sm text-red-600 whitespace-pre-wrap">
                                {selectedClaim.rejection_reason}
                              </p>
                            )
                          }

                          return (
                            <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3">
                              {parsedRejection.overall_remarks && (
                                <p className="text-sm text-red-700 mb-2">
                                  <span className="font-semibold">Summary:</span> {parsedRejection.overall_remarks}
                                </p>
                              )}

                              {parsedRejection.rejected_services.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-sm font-semibold text-red-700">
                                    Rejected Services ({parsedRejection.rejected_count || parsedRejection.rejected_services.length})
                                  </p>
                                  <ul className="space-y-2">
                                    {parsedRejection.rejected_services.map((service, index) => (
                                      <li key={`${service.service_name}-${index}`} className="text-sm text-red-700">
                                        <span className="font-medium">{service.service_name || "Service"}</span>
                                        {service.quantity ? ` (Qty: ${service.quantity})` : ""}
                                        {typeof service.service_amount === "number" ? ` - Amount: ₦${service.service_amount.toLocaleString()}` : ""}
                                        {service.rejection_reason ? ` - Reason: ${service.rejection_reason}` : ""}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {parsedRejection.rejection_date && (
                                <p className="text-xs text-red-600 mt-2">
                                  Date: {new Date(parsedRejection.rejection_date).toLocaleString("en-GB")}
                                </p>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Enrollee</label>
                      <p className="text-lg">{selectedClaim.enrollee_name} ({selectedClaim.enrollee_id})</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Provider</label>
                      <p className="text-lg">{selectedClaim.provider?.facility_name || 'Limi Hospital'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Band</label>
                      <p className="text-lg">Band B</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Plan</label>
                      <p className="text-lg">Gold SME</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Date of Service</label>
                      <p className="text-lg">{formatDate(selectedClaim.date)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Services Detail Table */}
              {(() => {
                try {
                  const services = typeof selectedClaim.services === 'string'
                    ? JSON.parse(selectedClaim.services)
                    : selectedClaim.services;
                  if (!Array.isArray(services) || services.length === 0) return null;
                  const hasModifiedPrices = services.some((s: any) => s.price_modified_by_call_centre);
                  return (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-lg font-semibold text-blue-600">Services Breakdown</h3>
                        {hasModifiedPrices && (
                          <span className="text-xs bg-orange-100 text-orange-700 border border-orange-300 rounded px-2 py-0.5">
                            ⚠ Orange = Price modified by Call Centre
                          </span>
                        )}
                      </div>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Service</TableHead>
                              <TableHead>Qty</TableHead>
                              <TableHead>Tariff Price</TableHead>
                              <TableHead>Final Price</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Remarks</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {services.map((service: any, index: number) => {
                              const isPriceModified = !!service.price_modified_by_call_centre;
                              const isRejected = service.coverage === 'REJECTED' || service.coverage === 'NOT_COVERED';
                              return (
                                <TableRow
                                  key={index}
                                  className={
                                    isPriceModified
                                      ? 'bg-orange-50 border-l-4 border-l-orange-400'
                                      : isRejected
                                      ? 'bg-red-50 border-l-4 border-l-red-400'
                                      : ''
                                  }
                                >
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{service.service_name || service.name}</span>
                                      {isPriceModified && (
                                        <Badge className="bg-orange-100 text-orange-700 text-xs border border-orange-300">
                                          Price Modified
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>{service.quantity || 1}</TableCell>
                                  <TableCell>
                                    {service.original_tariff_price != null
                                      ? `₦${Number(service.original_tariff_price).toLocaleString()}`
                                      : service.tariff_price != null
                                      ? `₦${Number(service.tariff_price).toLocaleString()}`
                                      : '-'}
                                  </TableCell>
                                  <TableCell className={isPriceModified ? 'font-semibold text-orange-700' : 'font-semibold'}>
                                    ₦{(Number(service.amount || service.final_price || service.approved_price || 0)).toLocaleString()}
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={
                                      isRejected ? 'bg-red-100 text-red-800' :
                                      service.coverage === 'COVERED' ? 'bg-green-100 text-green-800' :
                                      'bg-gray-100 text-gray-800'
                                    }>
                                      {service.coverage || 'Pending'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-sm text-gray-600">
                                    {service.remarks || service.rejection_reason || '-'}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                } catch {
                  return null;
                }
              })()}

              {/* Claim Description Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-blue-600 mb-2">Claim Description</h3>
                <p className="text-gray-700">
                  Patient treated for Malaria with full blood test and consultation.
                </p>
              </div>

              {/* Investigation Note Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-blue-600 mb-2">Investigation Note:</h3>
                <p className="text-gray-700">Cleared</p>
              </div>
            </div>
          </div>
        )}

        {/* Add Service Modal */}
        <Dialog open={showAddServiceModal} onOpenChange={setShowAddServiceModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl text-blue-600">Add Services to Approval Code</DialogTitle>
              <DialogDescription>
                Add services to approval code: {selectedRequestForAddService?.approval_code}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Ad-Hoc Service Section */}
              <Card className="border-orange-200">
                <CardHeader className="bg-orange-50">
                  <CardTitle className="text-orange-700 flex items-center justify-between">
                    <span>Add Ad-Hoc Service</span>
                    <Button
                      size="sm"
                      variant={showAdHocInput ? "destructive" : "default"}
                      onClick={() => setShowAdHocInput(!showAdHocInput)}
                      className={showAdHocInput ? "" : "bg-orange-600 hover:bg-orange-700"}
                    >
                      {showAdHocInput ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                      {showAdHocInput ? "Cancel" : "Add Manual Service"}
                    </Button>
                  </CardTitle>
                </CardHeader>
                {showAdHocInput && (
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Service Name</Label>
                        <Input
                          placeholder="Enter service name"
                          value={adHocServiceName}
                          onChange={(e) => setAdHocServiceName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Price (₦)</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={adHocServicePrice}
                          onChange={(e) => setAdHocServicePrice(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          value={adHocServiceQuantity}
                          onChange={(e) => setAdHocServiceQuantity(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button
                      className="mt-4 bg-orange-600 hover:bg-orange-700"
                      onClick={handleAddAdHocService}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Service
                    </Button>
                  </CardContent>
                )}
              </Card>

              {/* Selected Services */}
              {selectedServices.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-green-600">Selected Services ({selectedServices.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedServices.map((service) => (
                          <TableRow key={service.id} className={service.is_ad_hoc ? "bg-orange-50" : ""}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{service.service_name}</span>
                                {service.is_ad_hoc && (
                                  <Badge className="w-fit mt-1 bg-orange-200 text-orange-800">Ad-Hoc</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>₦{(service.service_amount || service.tariff_price || 0).toLocaleString()}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                value={service.quantity}
                                onChange={(e) => handleUpdateServiceQuantity(service.id, parseInt(e.target.value) || 1)}
                                className="w-20"
                              />
                            </TableCell>
                            <TableCell className="font-semibold">
                              ₦{((service.service_amount || service.tariff_price || 0) * service.quantity).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRemoveServiceFromSelected(service.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-gray-50 font-bold">
                          <TableCell colSpan={3}>Total Amount</TableCell>
                          <TableCell className="text-lg text-green-600">
                            ₦{selectedServices.reduce((sum, s) => sum + ((s.service_amount || s.tariff_price || 0) * s.quantity), 0).toLocaleString()}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Submit Button */}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddServiceModal(false)
                    setSelectedServices([])
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-[#0891B2] hover:bg-[#9B1219]"
                  onClick={() => submitAddedServicesMutation.mutate()}
                  disabled={selectedServices.length === 0 || submitAddedServicesMutation.isPending}
                >
                  {submitAddedServicesMutation.isPending ? "Submitting..." : `Submit ${selectedServices.length} Service(s)`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Audit Log Modal */}
        <Dialog
          open={showAuditLogModal}
          onOpenChange={(open) => {
            setShowAuditLogModal(open)
            if (!open) {
              setSelectedClaimForAudit(null)
            }
          }}
        >
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Audit Log</DialogTitle>
              <DialogDescription>
                Claim: {selectedClaimForAudit?.approval_code || selectedClaimForAudit?.id}
              </DialogDescription>
            </DialogHeader>
            {selectedClaimForAudit && (
              <AuditTrailView approvalCode={selectedClaimForAudit.approval_code || selectedClaimForAudit.id} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
  )
}
