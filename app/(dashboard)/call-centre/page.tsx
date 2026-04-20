"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { StatusText } from "@/components/ui/status-text"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Phone,
  TrendingUp,
  Users,
  FileText,
  Bell,
  Search,
  Eye,
  Plus,
  XCircle,
  CheckCircle,
  Clock,
  DollarSign,
  MoreHorizontal,
  Loader2,
  Trash2
} from "lucide-react"
import { useRouter } from "next/navigation"
import { PermissionGate } from "@/components/ui/permission-gate"
import { formatCountdown } from "@/lib/add-service-window"



interface CallCentreMetrics {
  approval_codes: number
  encounter_codes: number
  eligibility_process: number
  requests: number
}

interface ApprovalCode {
  id: string
  approval_code: string
  generated_by: string
  hospital: string
  services: string
  amount: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PARTIAL'
  date: string
  enrollee_id?: string
  enrollee_name?: string
  is_added_after_approval_request?: boolean
  is_primary_auto_approved?: boolean
  add_service_expires_at?: string | null
}

export default function CallCentreDashboard() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()

  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)
  const [showEncounterHistory, setShowEncounterHistory] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  // Delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteReason, setDeleteReason] = useState("")
  const [deletingRequest, setDeletingRequest] = useState<any>(null)

  // Reject modal states
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectingRequest, setRejectingRequest] = useState<any>(null)

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

  // Fetch call centre metrics
  const { data: metricsData } = useQuery({
    queryKey: ["call-centre-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/call-centre/metrics")
      if (!res.ok) {
        throw new Error("Failed to fetch call centre metrics")
      }
      return res.json()
    },
  })

  // Fetch provider requests
  const { data: providerRequestsData, isLoading } = useQuery({
    queryKey: ["provider-requests", currentPage, limit, debouncedSearchTerm, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        search: debouncedSearchTerm,
        status: selectedStatus
      })

      const res = await fetch(`/api/call-centre/provider-requests?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch provider requests")
      }
      return res.json()
    },
  })

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, selectedStatus])

  // Fetch encounter history (all approved and rejected requests)
  const { data: encounterHistory, isLoading: encounterHistoryLoading } = useQuery({
    queryKey: ["encounter-history"],
    queryFn: async () => {
      const res = await fetch("/api/call-centre/encounter-history")
      if (!res.ok) throw new Error("Failed to fetch encounter history")
      return res.json()
    },
    enabled: showEncounterHistory
  })

  const metrics = metricsData?.metrics || {
    approval_codes: 0,
    encounter_codes: 0,
    eligibility_process: 0,
    requests: 0
  }

  const providerRequests = providerRequestsData?.provider_requests || []
  const pagination = providerRequestsData?.pagination

  // Status badge color function
  const getStatusBadgeColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'APPROVED':
        return 'bg-green-100 text-green-800'
      case 'PARTIAL':
        return 'bg-orange-100 text-orange-800'
      case 'REJECTED':
        return 'bg-red-100 text-red-800'
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getRequestCountdown = (request: any) => {
    if (!request?.add_service_expires_at) return null
    const seconds = Math.max(
      0,
      Math.floor((new Date(request.add_service_expires_at).getTime() - currentTime) / 1000)
    )
    return {
      expired: seconds <= 0,
      label: formatCountdown(seconds)
    }
  }

  const handleViewApproval = (request: any) => {
    // Navigate to generate approval code page for review
    // Use the provider request ID, not approval code ID
    router.push(`/call-centre/generate-code?id=${request.id}`)
  }

  // Reject request mutation
  const rejectRequestMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/call-centre/provider-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to reject request')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Request Rejected",
        description: "Request has been successfully rejected",
      })
      setShowRejectModal(false)
      setRejectReason("")
      setRejectingRequest(null)
      queryClient.invalidateQueries({ queryKey: ["provider-requests"] })
      queryClient.invalidateQueries({ queryKey: ["call-centre-metrics"] })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject request",
        variant: "destructive",
      })
    },
  })

  const handleRejectRequest = (request: any) => {
    setRejectingRequest(request)
    setRejectReason("")
    setShowRejectModal(true)
  }

  const handleApproveRequest = (request: any) => {
    // Navigate to generate approval code page
    router.push(`/call-centre/generate-code?id=${request.id}`)
  }

  // Delete approval code mutation
  const deleteApprovalCodeMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/call-centre/approval-codes/${id}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete approval code')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Approval Code Deleted",
        description: "The approval code has been successfully deleted.",
      })
      setShowDeleteModal(false)
      setDeleteReason("")
      setDeletingRequest(null)
      queryClient.invalidateQueries({ queryKey: ["provider-requests"] })
      queryClient.invalidateQueries({ queryKey: ["call-centre-metrics"] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleDeleteApprovalCode = (request: any) => {
    setDeletingRequest(request)
    setShowDeleteModal(true)
  }

  return (
    <PermissionGate module="call-centre" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Call Centre</h1>
            <p className="text-gray-600">Manage customer support and approval codes</p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => setShowEncounterHistory(true)}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Previous Encounters
            </Button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approval Code</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.approval_codes}</div>
              <p className="text-xs text-muted-foreground">
                +5.6% this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Encounter Code</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.encounter_codes}</div>
              <p className="text-xs text-muted-foreground">
                +3.2% this week
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push('/call-centre/rejected-services')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected Services</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.eligibility_process}</div>
              <p className="text-xs text-muted-foreground">
                View rejected services
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Requests</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.requests}</div>
              <p className="text-xs text-muted-foreground">
                Today
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Provider Requests Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Provider Requests</CardTitle>
                <CardDescription>Review and approve approval code requests from providers</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by enrollee name, ID, provider name"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-56">
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Provider Requests Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Provider Requests</CardTitle>
                <CardDescription>Manage approval code requests from providers</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">Loading provider requests...</div>
              </div>
            ) : providerRequests.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">No provider requests found</div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-gray-600">ENROLLEE NAME</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ENROLLEE ID</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PROVIDER NAME</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">APPROVED BY</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">APPROVAL CODE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">DATE&TIME</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providerRequests.map((request: any) => (
                      <TableRow key={request.id}>
                        <TableCell className="table-cell">
                          {request.enrollee_name || '-'}
                        </TableCell>
                        <TableCell className="table-cell font-mono">
                          {request.enrollee_id || '-'}
                        </TableCell>
                        <TableCell className="table-cell">{request.provider_name}</TableCell>
                        <TableCell className="table-cell">{request.approved_by || '-'}</TableCell>
                        <TableCell className="table-cell font-mono">
                          {request.approval_code || '-'}
                        </TableCell>
                        <TableCell className="table-cell">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={getStatusBadgeColor(request.status)}>
                              {request.status.charAt(0).toUpperCase() + request.status.slice(1).toLowerCase()}
                            </Badge>
                            {request.is_primary_auto_approved && (
                              <Badge className="bg-slate-100 text-slate-700 border border-slate-200">
                                Primary Auto-Approved
                              </Badge>
                            )}
                          </div>
                          {request.is_added_after_approval_request && (() => {
                            const countdown = getRequestCountdown(request)
                            if (!countdown) return null
                            return (
                              <div className={`mt-1 text-xs ${countdown.expired ? 'text-red-600' : 'text-amber-700'}`}>
                                {countdown.expired ? 'Add service window elapsed' : `Window: ${countdown.label}`}
                              </div>
                            )
                          })()}
                        </TableCell>
                        <TableCell className="table-cell">
                          {new Date(request.date).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </TableCell>
                        <TableCell className="table-cell">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleViewApproval(request)}
                                className="w-full justify-start text-xs"
                              >
                                View Details
                              </DropdownMenuItem>
                              {request.status === 'PENDING' && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleApproveRequest(request)}
                                    className="w-full justify-start text-xs"
                                  >
                                    Generate Code
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleRejectRequest(request)}
                                    className="w-full justify-start text-xs text-red-600"
                                    disabled={rejectRequestMutation.isPending}
                                  >
                                    {rejectRequestMutation.isPending ? 'Rejecting...' : 'Reject'}
                                  </DropdownMenuItem>
                                </>
                              )}
                              {request.status === 'APPROVED' && request.is_primary_auto_approved && (
                                <DropdownMenuItem
                                  onClick={() => handleRejectRequest(request)}
                                  className="w-full justify-start text-xs text-red-600"
                                  disabled={rejectRequestMutation.isPending}
                                >
                                  {rejectRequestMutation.isPending ? 'Rejecting...' : 'Reject'}
                                </DropdownMenuItem>
                              )}
                              {request.status === 'APPROVED' && (
                                <DropdownMenuItem
                                  onClick={() => handleDeleteApprovalCode(request)}
                                  className="w-full justify-start text-xs text-red-600"
                                >
                                  <Trash2 className="h-3 w-3 mr-2" />
                                  Delete
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

        {/* Encounter History Modal */}
        <Dialog open={showEncounterHistory} onOpenChange={setShowEncounterHistory}>
          <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Previous Encounters</DialogTitle>
              <DialogDescription>
                Complete history of all approved and rejected provider requests
              </DialogDescription>
            </DialogHeader>

            {encounterHistoryLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-lg">Loading encounter history...</div>
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request ID</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Enrollee</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {encounterHistory?.encounters?.map((encounter: any) => (
                      <TableRow key={encounter.id}>
                        <TableCell className="font-medium">{encounter.request_id}</TableCell>
                        <TableCell>{encounter.provider_name}</TableCell>
                        <TableCell>{encounter.enrollee_name}</TableCell>
                        <TableCell>{encounter.service_type}</TableCell>
                        <TableCell>₦{encounter.amount?.toLocaleString()}</TableCell>
                        <TableCell>
                          <StatusIndicator status={encounter.status} />
                        </TableCell>
                        <TableCell>
                          {new Date(encounter.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowEncounterHistory(false)
                              router.push(`/call-centre/generate-code?id=${encounter.id}`)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {(!encounterHistory?.encounters || encounterHistory.encounters.length === 0) && (
                  <div className="text-center py-8">
                    <div className="text-gray-500">No encounter history found</div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Approval Code Modal */}
        <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Approval Code</DialogTitle>
              <DialogDescription>
                Please provide a reason for deleting this approval code. This action is irreversible and will be audited.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {deletingRequest && (
                <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                  <p className="text-sm"><span className="font-medium">Approval Code:</span> {deletingRequest.approval_code || '-'}</p>
                  <p className="text-sm"><span className="font-medium">Enrollee:</span> {deletingRequest.enrollee_name || '-'}</p>
                  <p className="text-sm"><span className="font-medium">Hospital:</span> {deletingRequest.provider_name || '-'}</p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Reason for Deletion <span className="text-red-500">*</span></label>
                <Textarea
                  placeholder="Enter reason for deletion..."
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowDeleteModal(false); setDeleteReason(""); setDeletingRequest(null) }}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!deleteReason.trim()) {
                    toast({
                      title: "Error",
                      description: "Please provide a deletion reason",
                      variant: "destructive",
                    })
                    return
                  }
                  if (deletingRequest) {
                    deleteApprovalCodeMutation.mutate({ id: deletingRequest.id, reason: deleteReason })
                  }
                }}
                disabled={deleteApprovalCodeMutation.isPending || !deleteReason.trim()}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteApprovalCodeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete Approval Code
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Provider Request Modal */}
        <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Provider Request</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting this request. This reason will be visible to the provider.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {rejectingRequest && (
                <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                  <p className="text-sm"><span className="font-medium">Enrollee:</span> {rejectingRequest.enrollee_name || '-'}</p>
                  <p className="text-sm"><span className="font-medium">Provider:</span> {rejectingRequest.provider_name || '-'}</p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Rejection Reason <span className="text-red-500">*</span></label>
                <Textarea
                  placeholder="Enter reason for rejection..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowRejectModal(false); setRejectReason(""); setRejectingRequest(null) }}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!rejectReason.trim()) {
                    toast({
                      title: "Error",
                      description: "Please provide a rejection reason",
                      variant: "destructive",
                    })
                    return
                  }
                  if (rejectingRequest) {
                    rejectRequestMutation.mutate({ id: rejectingRequest.id, reason: rejectReason })
                  }
                }}
                disabled={rejectRequestMutation.isPending || !rejectReason.trim()}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {rejectRequestMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Reject Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </PermissionGate>
  )
}
