"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Phone,
  Search,
  Eye,
  CheckCircle,
  Clock,
  DollarSign,
  Filter,
  Calendar,
  Building2,
  XCircle,
  User,
  MoreHorizontal,
  Stethoscope,
  TestTube,
  History,
  AlertCircle,
  CheckCircle2,
  Loader2
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { useRouter } from "next/navigation"
import { formatCountdown } from "@/lib/add-service-window"



interface ProviderRequest {
  id: string
  date: string
  hospital: string
  claim_id: string
  services: string
  amount: number
  status: 'NEW' | 'PROCESSED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PARTIAL'
  enrollee_id?: string
  enrollee_name?: string
  beneficiary_id?: string
  beneficiary_name?: string
  is_dependent?: boolean
  provider_id: string
  provider_name: string
  is_added_after_approval_request?: boolean
  add_service_expires_at?: string | null
}

interface DetailedRequest {
  id: string
  request_id: string
  provider_id: string
  enrollee_id: string
  hospital: string
  services: Array<{
    service_name: string
    service_type?: number
    amount: number
    quantity?: number
    is_covered: boolean
    coverage_limit?: number
    coverage_bands?: string[]
    is_added_after_approval?: boolean
    provider_additional_comment?: string | null
  }>
  amount: number
  diagnosis: string | null
  added_services_comment?: string | null
  status: string
  created_at: string
  add_service_expires_at?: string | null
  add_service_window_expired?: boolean
  is_added_after_approval_request?: boolean
  provider: {
    id: string
    facility_name: string
  }
  enrollee: {
    id: string
    enrollee_id: string
    first_name: string
    last_name: string
    plan: {
      name: string
      band_type: string
    }
  }
  previous_encounters?: Array<{
    code: string
    hospital: string
    services: string
    amount: number
    status: string
    created_at: string
    claim?: {
      status: string
    }
  }>
  previous_approval_codes?: Array<{
    approval_code: string
    hospital: string
    services: string
    amount: number
    status: string
    created_at: string
  }>
}

const getServiceSubtotal = (service: { amount: number; quantity?: number }) => {
  const unitAmount = Number(service.amount || 0)
  const quantity = Number(service.quantity || 1) || 1
  return unitAmount * quantity
}

interface TelemedicineRequest {
  id: string
  request_type: string
  test_name: string
  description: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  created_at: string
  enrollee: {
    enrollee_id: string
    first_name: string
    last_name: string
    phone_number: string
  }
  facility: {
    facility_name: string
    facility_type: string
  }
  created_by: {
    first_name: string
    last_name: string
  }
  appointment: {
    scheduled_date: string
    reason: string
  }
}

export default function RequestsFromProviderPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()
  
  // State for active tab
  const [activeTab, setActiveTab] = useState<'provider' | 'telemedicine'>('provider')
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedProvider, setSelectedProvider] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Modal states
  const [showViewModal, setShowViewModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ProviderRequest | null>(null)
  const [detailedRequest, setDetailedRequest] = useState<DetailedRequest | null>(null)
  const [selectedTelemedicineRequest, setSelectedTelemedicineRequest] = useState<TelemedicineRequest | null>(null)
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({})
  const [rejectReason, setRejectReason] = useState("")
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  // Fetch provider requests
  const { data: requestsData, isLoading } = useQuery({
    queryKey: ["provider-requests", currentPage, limit, debouncedSearchTerm, selectedStatus, selectedProvider],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        search: debouncedSearchTerm,
        status: selectedStatus,
        provider: selectedProvider
      })
      
      const res = await fetch(`/api/call-centre/provider-requests?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch provider requests")
      }
      return res.json()
    },
  })

  // Fetch telemedicine requests
  const { data: telemedicineRequestsData, isLoading: telemedicineLoading } = useQuery({
    queryKey: ["telemedicine-requests", currentPage, limit, debouncedSearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        search: debouncedSearchTerm
      })
      
      const res = await fetch(`/api/call-centre/telemedicine-requests?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch telemedicine requests")
      }
      return res.json()
    },
    enabled: activeTab === 'telemedicine'
  })

  // Fetch providers for filter
  const { data: providersData } = useQuery({
    queryKey: ["providers"],
    queryFn: async () => {
      const res = await fetch("/api/providers")
      if (!res.ok) {
        throw new Error("Failed to fetch providers")
      }
      return res.json()
    },
  })

  const requests = requestsData?.requests || []
  const pagination = requestsData?.pagination
  const telemedicineRequests = telemedicineRequestsData?.telemedicineRequests || []
  const telemedicinePagination = telemedicineRequestsData?.pagination
  const providers = providersData?.providers || []

  // Process request mutation
  const processRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch(`/api/call-centre/provider-requests/${requestId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!res.ok) {
        throw new Error('Failed to process request')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Request processed successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["provider-requests"] })
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process request",
        variant: "destructive",
      })
    },
  })

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'NEW':
        return 'bg-blue-100 text-blue-800'
      case 'PROCESSED':
        return 'bg-green-100 text-green-800'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'APPROVED':
        return 'bg-green-100 text-green-800'
      case 'REJECTED':
        return 'bg-red-100 text-red-800'
      case 'PARTIAL':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getCountdownMeta = (expiresAt?: string | null) => {
    if (!expiresAt) return null
    const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - currentTime) / 1000))
    return {
      expired: seconds <= 0,
      label: formatCountdown(seconds)
    }
  }

  const handleViewRequest = async (request: ProviderRequest) => {
    // Navigate to generate code page
    router.push(`/call-centre/generate-code?id=${request.id}`)
  }

  const handleApproveRequest = async () => {
    if (!detailedRequest) return

    try {
      const res = await fetch(`/api/call-centre/provider-requests/${detailedRequest.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          services: detailedRequest.services.map((service, index) => ({
            ...service,
            is_approved: selectedServices[`${index}`],
            rejection_reason: !selectedServices[`${index}`] ? 'Service not covered or not selected' : undefined
          })),
          diagnosis: detailedRequest.diagnosis,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to approve request')
      }

      const result = await res.json()
      
      toast({
        title: "Success",
        description: result.message || "Request processed successfully",
      })

      // Close modals and refresh data
      setShowApproveModal(false)
      setShowViewModal(false)
      queryClient.invalidateQueries({ queryKey: ["provider-requests"] })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve request",
        variant: "destructive",
      })
    }
  }

  const handleRejectRequest = async () => {
    if (!detailedRequest) return
    
    if (!rejectReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      })
      return
    }
    
    try {
      const res = await fetch(`/api/call-centre/provider-requests/${detailedRequest.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: rejectReason,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to reject request')
      }

      const result = await res.json()
      
      toast({
        title: "Success",
        description: result.message || "Request rejected successfully",
      })

      // Close modals and refresh data
      setShowRejectModal(false)
      setShowViewModal(false)
      setRejectReason("")
      queryClient.invalidateQueries({ queryKey: ["provider-requests"] })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject request",
        variant: "destructive",
      })
    }
  }

  const handleProcessRequest = async (request: ProviderRequest) => {
    if (window.confirm(`Are you sure you want to process request ${request.claim_id}?`)) {
      processRequestMutation.mutate(request.id)
    }
  }

  // Telemedicine request handlers
  const handleViewTelemedicineRequest = (request: TelemedicineRequest) => {
    setSelectedTelemedicineRequest(request)
    setShowViewModal(true)
  }

  const handleProcessTelemedicineRequest = async (request: TelemedicineRequest, action: 'approve' | 'reject') => {
    if (window.confirm(`Are you sure you want to ${action} this telemedicine request?`)) {
      try {
        const res = await fetch(`/api/call-centre/telemedicine-requests/${request.id}/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action }),
        })

        if (!res.ok) {
          throw new Error('Failed to process request')
        }

        toast({
          title: "Success",
          description: `Telemedicine request ${action}d successfully`,
        })

        // Refresh the data
        queryClient.invalidateQueries({ queryKey: ["telemedicine-requests"] })
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to process telemedicine request",
          variant: "destructive",
        })
      }
    }
  }

  const getRequestTypeBadge = (type: string) => {
    switch (type) {
      case 'LAB':
        return 'bg-blue-100 text-blue-800'
      case 'RADIOLOGY':
        return 'bg-purple-100 text-purple-800'
      case 'PHARMACY':
        return 'bg-green-100 text-green-800'
      case 'REFERRAL':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <PermissionGate module="call-centre" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Call Centre Requests</h1>
            <p className="text-gray-600">Manage and process requests from providers and telemedicine</p>
          </div>
          <Button
            variant="outline"
            className="flex items-center gap-2 text-sm"
            onClick={() => router.push("/call-centre/previous-encounters")}
          >
            <History className="h-4 w-4" />
            Previous Encounters
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('provider')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'provider'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Building2 className="h-4 w-4" />
            Provider Requests
          </button>
          <button
            onClick={() => setActiveTab('telemedicine')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'telemedicine'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Stethoscope className="h-4 w-4" />
            Telemedicine Requests
          </button>
        </div>

        {/* Provider Requests Tab */}
        {activeTab === 'provider' && (
          <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Requests from Providers</CardTitle>
                <CardDescription>Review and process provider requests</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Request Filters */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search requests..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="PROCESSED">Processed</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="PARTIAL">Partial</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  {providers.map((provider: any) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Requests Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">Loading requests...</div>
              </div>
            ) : requests.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">No requests found</div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">HOSPITAL</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">CLAIM ID</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">SERVICES</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request: ProviderRequest) => (
                      <TableRow key={request.id}>
                        <TableCell>{new Date(request.date).toLocaleDateString('en-GB')}</TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-900">
                            {request.hospital}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{request.claim_id}</TableCell>
                        <TableCell>{request.services}</TableCell>
                        <TableCell className="font-semibold text-green-600">
                          ₦{request.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(request.status)}>
                            {request.status}
                          </Badge>
                          {request.is_added_after_approval_request && (() => {
                            const countdown = getCountdownMeta(request.add_service_expires_at)
                            if (!countdown) return null
                            return (
                              <div className={`mt-1 text-xs ${countdown.expired ? 'text-red-600' : 'text-amber-700'}`}>
                                {countdown.expired ? 'Add service window elapsed' : `Window: ${countdown.label}`}
                              </div>
                            )
                          })()}
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
                                onClick={() => handleViewRequest(request)}
                                className="w-full justify-start text-xs"
                              >
                                <Eye className="h-3 w-3 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {request.status === 'PENDING' && (
                                <PermissionGate module="call-centre" action="edit">
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      handleViewRequest(request)
                                      setTimeout(() => setShowApproveModal(true), 500)
                                    }}
                                    className="text-green-600 w-full justify-start text-xs"
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-2" />
                                    Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      handleViewRequest(request)
                                      setTimeout(() => setShowRejectModal(true), 500)
                                    }}
                                    className="text-red-600 w-full justify-start text-xs"
                                  >
                                    <XCircle className="h-3 w-3 mr-2" />
                                    Reject
                                  </DropdownMenuItem>
                                </PermissionGate>
                              )}
                              {request.status === 'NEW' && (
                                <PermissionGate module="call-centre" action="edit">
                                  <DropdownMenuItem 
                                    onClick={() => handleProcessRequest(request)}
                                    disabled={processRequestMutation.isPending}
                                    className="text-blue-600 w-full justify-start text-xs"
                                  >
                                    Process
                                  </DropdownMenuItem>
                                </PermissionGate>
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
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
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
        )}

        {/* Telemedicine Requests Tab */}
        {activeTab === 'telemedicine' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Telemedicine Requests</CardTitle>
                  <CardDescription>Review and process telemedicine requests</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Request Filters */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search telemedicine requests..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Telemedicine Requests Table */}
              {telemedicineLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Patient</TableHead>
                          <TableHead>Request Type</TableHead>
                          <TableHead>Test/Service</TableHead>
                          <TableHead>Facility</TableHead>
                          <TableHead>Requested By</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {telemedicineRequests.map((request: TelemedicineRequest) => (
                          <TableRow key={request.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {request.enrollee.first_name} {request.enrollee.last_name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  ID: {request.enrollee.enrollee_id}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getRequestTypeBadge(request.request_type)}>
                                {request.request_type}
                              </Badge>
                            </TableCell>
                            <TableCell>{request.test_name}</TableCell>
                            <TableCell>{request.facility?.facility_name || 'N/A'}</TableCell>
                            <TableCell>
                              {request.created_by.first_name} {request.created_by.last_name}
                            </TableCell>
                            <TableCell>
                              {new Date(request.created_at).toLocaleDateString('en-GB')}
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusBadgeColor(request.status)}>
                                {request.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleViewTelemedicineRequest(request)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  {request.status === 'PENDING' && (
                                    <>
                                      <DropdownMenuItem onClick={() => handleProcessTelemedicineRequest(request, 'approve')}>
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Approve
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleProcessTelemedicineRequest(request, 'reject')}>
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Reject
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {telemedicinePagination && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-gray-600">
                        Showing {((telemedicinePagination.page - 1) * telemedicinePagination.limit) + 1} to {Math.min(telemedicinePagination.page * telemedicinePagination.limit, telemedicinePagination.total)} of {telemedicinePagination.total} results
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={telemedicinePagination.page === 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm">
                          Page {telemedicinePagination.page} of {telemedicinePagination.pages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, telemedicinePagination.pages))}
                          disabled={telemedicinePagination.page === telemedicinePagination.pages}
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
        )}

        {/* View Request Modal */}
        {/* Enhanced View Modal */}
        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Service Request Details</DialogTitle>
              <DialogDescription>
                {detailedRequest ? `Request #${detailedRequest.request_id}` : 'Loading...'}
              </DialogDescription>
            </DialogHeader>

            {isLoadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : detailedRequest ? (
              <div className="space-y-6">
                {/* Enrollee & Provider Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Enrollee</label>
                    <p className="text-sm font-semibold">{detailedRequest.enrollee.first_name} {detailedRequest.enrollee.last_name}</p>
                    <p className="text-xs text-gray-500">{detailedRequest.enrollee.enrollee_id}</p>
                    <Badge className="mt-1 text-xs">{detailedRequest.enrollee.plan.name}</Badge>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Provider</label>
                    <p className="text-sm font-semibold">{detailedRequest.provider.facility_name}</p>
                    <p className="text-xs text-gray-500">{detailedRequest.hospital}</p>
                  </div>
                </div>

                {/* Services Table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-lg">Services</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/call-centre/previous-encounters")}
                    >
                      <History className="h-4 w-4 mr-2" />
                      Previous Encounters
                    </Button>
                  </div>
                  
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service Name</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Subtotal</TableHead>
                          <TableHead>Coverage</TableHead>
                          <TableHead>Limit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailedRequest.services.map((service, index) => (
                          <TableRow
                            key={index}
                            className={service.is_added_after_approval ? "bg-blue-50 border-l-4 border-l-blue-500" : ""}
                          >
                            <TableCell className="font-medium">{service.service_name}</TableCell>
                            <TableCell>{service.quantity || 1}</TableCell>
                            <TableCell className="font-semibold text-green-600">
                              ₦{service.amount.toLocaleString()}
                            </TableCell>
                            <TableCell className="font-semibold text-blue-600">
                              ₦{getServiceSubtotal(service).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {service.is_added_after_approval ? (
                                <Badge className="bg-blue-100 text-blue-800">
                                  Added Service
                                </Badge>
                              ) : service.is_covered ? (
                                <Badge className="bg-green-100 text-green-800">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Covered
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Not Covered
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {service.coverage_limit ? (
                                <span className="text-sm">₦{service.coverage_limit.toLocaleString()}</span>
                              ) : (
                                <span className="text-sm text-gray-400">No limit</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Total Amount */}
                  <div className="flex justify-end mt-2 p-3 bg-gray-50 rounded">
                    <div className="text-right">
                      {(detailedRequest.status === 'PARTIAL' || detailedRequest.status === 'APPROVED') && (() => {
                        const approvedTotal = detailedRequest.services
                          .filter((s: any) => s.coverage === 'COVERED' || s.coverage === 'EXCEEDED' || s.coverage === 'LIMIT_EXCEEDED' || s.is_covered === true)
                          .reduce((sum: number, s: any) => sum + ((Number(s.amount) || 0) * (Number(s.quantity) || 1)), 0)
                        const rejectedTotal = detailedRequest.services
                          .filter((s: any) => s.coverage === 'REJECTED' || s.coverage === 'NOT_COVERED' || s.is_covered === false)
                          .reduce((sum: number, s: any) => sum + ((Number(s.amount) || 0) * (Number(s.quantity) || 1)), 0)
                        return (
                          <>
                            {rejectedTotal > 0 && (
                              <p className="text-sm text-red-500">
                                Rejected: ₦{rejectedTotal.toLocaleString()}
                              </p>
                            )}
                            <p className="text-sm text-gray-600">Approved Amount</p>
                            <p className="text-lg font-bold text-green-600">
                              ₦{approvedTotal.toLocaleString()}
                            </p>
                          </>
                        )
                      })()}
                      {detailedRequest.status !== 'PARTIAL' && detailedRequest.status !== 'APPROVED' && (
                        <>
                          <p className="text-sm text-gray-600">Total Amount</p>
                          <p className="text-lg font-bold text-green-600">
                            ₦{detailedRequest.amount.toLocaleString()}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Diagnosis */}
                {detailedRequest.diagnosis && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <label className="text-sm font-medium text-gray-700">Diagnosis</label>
                    <p className="text-sm mt-1">{detailedRequest.diagnosis}</p>
                  </div>
                )}

                {detailedRequest.added_services_comment && (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <label className="text-sm font-medium text-amber-800">Added Services Comment</label>
                    <p className="text-sm mt-1 text-amber-900">{detailedRequest.added_services_comment}</p>
                  </div>
                )}

                {detailedRequest.is_added_after_approval_request && (() => {
                  const countdown = getCountdownMeta(detailedRequest.add_service_expires_at)
                  if (!countdown) return null
                  return (
                    <div className={`p-4 rounded-lg border ${countdown.expired ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                      <label className={`text-sm font-medium ${countdown.expired ? 'text-red-800' : 'text-amber-800'}`}>
                        Add Service Countdown
                      </label>
                      <p className={`text-sm mt-1 ${countdown.expired ? 'text-red-900' : 'text-amber-900'}`}>
                        {countdown.expired ? '24-hour add service window has elapsed.' : `Time remaining: ${countdown.label}`}
                      </p>
                    </div>
                  )
                })()}

                {/* Action Buttons */}
                {detailedRequest.status === 'PENDING' && (
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setShowViewModal(false)}>
                      Close
                    </Button>
                    <PermissionGate module="call-centre" action="edit">
                      <Button
                        variant="destructive"
                        onClick={() => {
                          setShowViewModal(false)
                          setShowRejectModal(true)
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                      <Button
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          setShowViewModal(false)
                          setShowApproveModal(true)
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                    </PermissionGate>
                  </DialogFooter>
                )}
              </div>
            ) : selectedTelemedicineRequest ? (
              <div className="space-y-6">
                {/* Keep telemedicine request display as is */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Telemedicine Request Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Request Type</label>
                      <Badge className={getRequestTypeBadge(selectedTelemedicineRequest.request_type)}>
                        {selectedTelemedicineRequest.request_type}
                      </Badge>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Test/Service</label>
                      <p className="text-sm">{selectedTelemedicineRequest.test_name}</p>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowViewModal(false)}>
                    Close
                  </Button>
                  {selectedTelemedicineRequest.status === 'PENDING' && (
                    <PermissionGate module="call-centre" action="edit">
                      <Button
                        onClick={() => {
                          setShowViewModal(false)
                          handleProcessTelemedicineRequest(selectedTelemedicineRequest, 'approve')
                        }}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Approve
                      </Button>
                    </PermissionGate>
                  )}
                </DialogFooter>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Previous encounters are now available via the dedicated history page */}

        {/* Approve Modal with Service Selection */}
        <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Approve Services</DialogTitle>
              <DialogDescription>
                Select services to approve. Unselected services will be rejected.
              </DialogDescription>
            </DialogHeader>

            {detailedRequest && (
              <div className="space-y-4">
                <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                  {detailedRequest.services.map((service, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-4 hover:bg-gray-50 ${service.is_added_after_approval ? "bg-blue-50 border-l-4 border-l-blue-500" : ""}`}
                    >
                      <Checkbox
                        checked={selectedServices[`${index}`]}
                        onCheckedChange={(checked) =>
                          setSelectedServices((prev) => ({
                            ...prev,
                            [`${index}`]: checked as boolean,
                          }))
                        }
                      />
                      <div className="flex-1">
                        <p className="font-medium">{service.service_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm font-semibold text-green-600">
                            ₦{service.amount.toLocaleString()}
                          </p>
                          {service.is_added_after_approval && (
                            <Badge className="bg-blue-100 text-blue-800 text-xs">
                              Added Service
                            </Badge>
                          )}
                          {service.is_covered ? (
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              Covered
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 text-xs">
                              Not Covered
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Selected Services:</span>
                    <span className="font-semibold">
                      {Object.values(selectedServices).filter(Boolean).length} / {detailedRequest.services.length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span>Total Amount:</span>
                    <span className="font-semibold text-green-600">
                      ₦{detailedRequest.services
                        .filter((_, index) => selectedServices[`${index}`])
                        .reduce((sum, service) => sum + service.amount, 0)
                        .toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowApproveModal(false)}>
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={handleApproveRequest}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve Selected
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Modal */}
        <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Request</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting this request
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Textarea
                placeholder="Enter rejection reason..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectModal(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRejectRequest}
                disabled={!rejectReason.trim()}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
  )
}
