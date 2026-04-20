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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
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
  Loader2
} from "lucide-react"
import { useRouter } from "next/navigation"
import { PermissionGate } from "@/components/ui/permission-gate"



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
  request_id?: string
  provider_name?: string
  hospital_name?: string
  beneficiary_id?: string
  beneficiary_name?: string
  is_dependent?: boolean
}

export default function CallCentreDashboard() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()

  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Modal states
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedApproval, setSelectedApproval] = useState<ApprovalCode | null>(null)

  // Rejection states
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [rejectingRequest, setRejectingRequest] = useState<ApprovalCode | null>(null)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch call centre metrics
  const { data: metricsData } = useQuery({
    queryKey: ["call-centre-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/request-from-provider/metrics")
      if (!res.ok) {
        throw new Error("Failed to fetch call centre metrics")
      }
      return res.json()
    },
  })

  // Fetch provider requests
  const { data: providerRequestsData, isLoading } = useQuery({
    queryKey: ["provider-requests", currentPage, limit, debouncedSearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        search: debouncedSearchTerm
      })

      const res = await fetch(`/api/request-from-provider/provider-requests?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch provider requests")
      }
      return res.json()
    },
  })

  const metrics = metricsData?.metrics || {
    approval_codes: 0,
    encounter_codes: 0,
    eligibility_process: 0,
    requests: 0
  }

  const providerRequests = providerRequestsData?.provider_requests || []
  const pagination = providerRequestsData?.pagination

  const handleViewApproval = (approval: ApprovalCode) => {
    setSelectedApproval(approval)
    setShowViewModal(true)
  }

  const handleApproveRequest = (request: any) => {
    // Navigate to generate approval code page
    router.push(`/generate-approval-code?id=${request.id}`)
  }

  const rejectRequestMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string, reason: string }) => {
      const res = await fetch(`/api/request-from-provider/provider-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to reject request')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Request Rejected",
        description: "The request has been successfully rejected.",
      })
      setShowRejectModal(false)
      setRejectionReason("")
      setRejectingRequest(null)
      queryClient.invalidateQueries({ queryKey: ["provider-requests"] })
      queryClient.invalidateQueries({ queryKey: ["call-centre-metrics"] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  })

  const handleRejectRequest = (request: ApprovalCode) => {
    setRejectingRequest(request)
    setShowRejectModal(true)
  }

  return (
    <PermissionGate module="request-from-provider" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Request from Provider</h1>
            <p className="text-gray-600">Review and manage approval code requests from providers</p>
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Eligibility Process</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.eligibility_process}</div>
              <p className="text-xs text-muted-foreground">
                Limits flag off
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
                    placeholder="Search by ID, name, Phone number"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
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
                      <TableHead className="text-xs font-medium text-gray-600">REQUEST ID</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">REQUEST CODE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PROVIDER NAME</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">BENEFICIARY</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">SERVICES</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providerRequests.map((request: any) => (
                      <TableRow key={request.id}>
                        <TableCell className="table-cell font-mono">
                          {request.request_id}
                        </TableCell>
                        <TableCell className="table-cell font-mono">
                          {request.approval_code || '-'}
                        </TableCell>
                        <TableCell className="table-cell">{request.provider_name}</TableCell>
                        <TableCell className="table-cell">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {request.beneficiary_name || request.enrollee_name || "Unknown"}
                            </span>
                            {request.is_dependent && (
                              <Badge className="text-[10px] uppercase bg-purple-100 text-purple-800">
                                Dependent
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            ID: {request.beneficiary_id || request.enrollee_id || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell className="table-cell">{request.services}</TableCell>
                        <TableCell className="table-cell font-semibold text-green-600">
                          ₦{request.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="table-cell">
                          <StatusText status={request.status} />
                        </TableCell>
                        <TableCell className="table-cell">{new Date(request.date).toLocaleDateString('en-GB')}</TableCell>
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
                                Review
                              </DropdownMenuItem>
                              {request.status !== 'APPROVED' && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleApproveRequest(request)}
                                    className="w-full justify-start text-xs"
                                  >
                                    Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleRejectRequest(request)}
                                    className="w-full justify-start text-xs text-red-600"
                                  >
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

        {/* View Provider Request Modal */}
        {showViewModal && selectedApproval && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Provider Request Details</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowViewModal(false)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>Request ID: {selectedApproval.request_id || selectedApproval.id}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Request Information */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Request Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Request ID</label>
                      <p className="text-sm font-semibold">{selectedApproval.request_id || selectedApproval.id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Request Code</label>
                      <p className="text-sm font-mono">{selectedApproval.approval_code || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Status</label>
                      <StatusText status={selectedApproval.status} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Provider Name</label>
                      <p className="text-sm">{selectedApproval.provider_name || selectedApproval.hospital}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Date</label>
                      <p className="text-sm">{new Date(selectedApproval.date).toLocaleDateString('en-GB')}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Hospital</label>
                      <p className="text-sm">{selectedApproval.hospital_name || selectedApproval.hospital}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Beneficiary</label>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">
                          {selectedApproval.beneficiary_name || selectedApproval.enrollee_name || "Unknown"}
                        </p>
                        <p className="text-xs text-gray-500">
                          ID: {selectedApproval.beneficiary_id || selectedApproval.enrollee_id || "N/A"}
                        </p>
                        {selectedApproval.is_dependent && (
                          <Badge className="text-[10px] uppercase bg-purple-100 text-purple-800 inline-flex items-center gap-1">
                            Dependent
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Amount</label>
                      <p className="text-sm font-semibold text-green-600">₦{selectedApproval.amount.toLocaleString()}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-600">Services</label>
                      {(() => {
                        try {
                          const parsedServices = JSON.parse(selectedApproval.services)
                          if (Array.isArray(parsedServices)) {
                            return (
                              <div className="grid grid-cols-1 gap-2 mt-2">
                                {parsedServices.map((service: any, idx: number) => {
                                  const isAdHoc = service.is_ad_hoc || service.unit_price === 0 || service.amount === 0;
                                  const isAddedLater = service.is_added_later || !!service.added_at;

                                  let bgColor = "bg-gray-50 border-gray-200";
                                  let textColor = "text-gray-900";
                                  let badge = null;

                                  if (isAdHoc) {
                                    bgColor = "bg-orange-50 border-orange-200";
                                    textColor = "text-orange-900";
                                    badge = <Badge className="bg-orange-500 text-white text-[10px] ml-2">Ad-hoc/0-Price</Badge>;
                                  } else if (isAddedLater) {
                                    bgColor = "bg-purple-50 border-purple-200";
                                    textColor = "text-purple-900";
                                    badge = <Badge className="bg-purple-500 text-white text-[10px] ml-2">Post-Approval Addition</Badge>;
                                  }

                                  return (
                                    <div key={idx} className={`p-3 rounded-lg border ${bgColor} flex justify-between items-center`}>
                                      <div>
                                        <div className="flex items-center">
                                          <span className={`font-medium ${textColor}`}>{service.service_name || service.name}</span>
                                          {badge}
                                        </div>
                                        <p className="text-xs text-gray-500">Qty: {service.quantity || 1}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className={`font-semibold ${textColor}`}>₦{parseFloat(service.amount || 0).toLocaleString()}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )
                          }
                        } catch (e) {
                          return <p className="text-sm mt-1">{selectedApproval.services}</p>
                        }
                        return <p className="text-sm mt-1">{selectedApproval.services}</p>
                      })()}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowViewModal(false)}
                  >
                    Close
                  </Button>
                  {selectedApproval.status !== 'APPROVED' && (
                    <Button
                      onClick={() => handleApproveRequest(selectedApproval)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve Request
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        {/* Rejection Reason Modal */}
        <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Provider Request</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting this request. This reason will be visible to the provider.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Rejection Reason</label>
                <Textarea
                  placeholder="Enter reason for rejection..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!rejectionReason.trim()) {
                    toast({
                      title: "Error",
                      description: "Please provide a rejection reason",
                      variant: "destructive",
                    })
                    return
                  }
                  if (rejectingRequest) {
                    rejectRequestMutation.mutate({ id: rejectingRequest.id, reason: rejectionReason })
                  }
                }}
                disabled={rejectRequestMutation.isPending || !rejectionReason.trim()}
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

