"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  Calendar,
  Paperclip
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import { FileViewerModal } from "@/components/ui/file-viewer-modal"

interface ProcurementRequest {
  id: string
  date: string
  invoice_id: string
  service: string
  department: string
  amount: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PENDING_OPERATIONS' | 'PENDING_MD' | 'PENDING_FINANCE'
  created_at: string
  requested_by: string
  description?: string
  attachment_url?: string
  attachment_name?: string
  // Comment history fields
  dept_oversight_comment?: string
  dept_oversight_at?: string
  dept_oversight_by?: {
    first_name?: string
    last_name?: string
    email?: string
  }
  operations_comment?: string
  operations_at?: string
  operations_by?: {
    first_name?: string
    last_name?: string
    email?: string
  }
  executive_comment?: string
  executive_at?: string
  executive_by?: {
    first_name?: string
    last_name?: string
    email?: string
  }
}

export default function DepartmentOversightPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedDepartment, setSelectedDepartment] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Modal states
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ProcurementRequest | null>(null)
  const [fileViewer, setFileViewer] = useState<{ url: string; name: string } | null>(null)
  const [comment, setComment] = useState("")

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch procurement requests
  const { data: requestsData, isLoading } = useQuery({
    queryKey: ["department-oversight-requests", currentPage, limit, debouncedSearchTerm, startDate, endDate, selectedDepartment, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(selectedDepartment !== "all" && { department: selectedDepartment }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
      })
      
      const res = await fetch(`/api/department-oversight/requests?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch procurement requests")
      }
      return res.json()
    },
  })

  const requests = requestsData?.requests || []
  const pagination = requestsData?.pagination

  // Approve request mutation
  const approveRequestMutation = useMutation({
    mutationFn: async ({ requestId, comment }: { requestId: string, comment?: string }) => {
      const res = await fetch(`/api/department-oversight/requests/${requestId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment })
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to approve request')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Request approved successfully" })
      queryClient.invalidateQueries({ queryKey: ["department-oversight-requests"] })
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      })
    }
  })

  // Reject request mutation
  const rejectRequestMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string, reason: string }) => {
      const res = await fetch(`/api/department-oversight/requests/${requestId}/reject`, {
        method: 'PATCH',
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
      toast({ title: "Request rejected successfully" })
      queryClient.invalidateQueries({ queryKey: ["department-oversight-requests"] })
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      })
    }
  })

  const handleViewDetails = (request: ProcurementRequest) => {
    setSelectedRequest(request)
    setShowApprovalModal(true)
    setComment("")
  }

  const handleApprove = async () => {
    if (!selectedRequest) return
    
    await approveRequestMutation.mutateAsync({ 
      requestId: selectedRequest.id,
      comment: comment.trim()
    })
    setShowApprovalModal(false)
    setSelectedRequest(null)
    setComment("")
  }

  const handleReject = async () => {
    if (!selectedRequest || !comment.trim()) {
      toast({ 
        title: "Error", 
        description: "Please provide a reason for rejection", 
        variant: "destructive" 
      })
      return
    }
    
    await rejectRequestMutation.mutateAsync({ 
      requestId: selectedRequest.id, 
      reason: comment.trim() 
    })
    setShowApprovalModal(false)
    setSelectedRequest(null)
    setComment("")
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pending</Badge>
      case 'APPROVED':
        return <Badge variant="outline" className="text-green-600 border-green-600">Approved</Badge>
      case 'REJECTED':
        return <Badge variant="outline" className="text-red-600 border-red-600">Rejected</Badge>
      case 'PENDING_OPERATIONS':
        return <Badge variant="outline" className="text-blue-600 border-blue-600">Pending Operations</Badge>
      case 'PENDING_MD':
        return <Badge variant="outline" className="text-purple-600 border-purple-600">Pending MD</Badge>
      case 'PENDING_FINANCE':
        return <Badge variant="outline" className="text-indigo-600 border-indigo-600">Pending Finance</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatAmount = (amount: number) => {
    return `N${amount.toLocaleString()}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB')
  }

  return (
    <PermissionGate module="department-oversight" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Department Oversight</h1>
            <p className="text-gray-600">Manage department services</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-2 block">Start Date</label>
                <div className="relative">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="Start Date"
                  />
                  <Calendar className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600 mb-2 block">End Date</label>
                <div className="relative">
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="End Date"
                  />
                  <Calendar className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600 mb-2 block">Department</label>
                <Input
                  placeholder="Department"
                  value={selectedDepartment === "all" ? "" : selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value || "all")}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600 mb-2 block">Status</label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="PENDING_OPERATIONS">Pending Operations</SelectItem>
                    <SelectItem value="PENDING_MD">Pending MD</SelectItem>
                    <SelectItem value="PENDING_FINANCE">Pending Finance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-end">
                <Button 
                  onClick={() => {
                    setCurrentPage(1)
                    queryClient.invalidateQueries({ queryKey: ["department-oversight-requests"] })
                  }}
                  className="w-full bg-[#BE1522] hover:bg-[#9B1219] text-white"
                >
                  Apply Filter
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Procurement Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Procurement</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No procurement requests found
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">INVOICE ID</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">SERVICE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">DEPARTMENT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                      <TableHead className="text-right text-xs font-medium text-gray-600">ACTION</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request: ProcurementRequest) => (
                      <TableRow key={request.id}>
                        <TableCell className="text-sm">
                          {formatDate(request.date)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {request.invoice_id}
                        </TableCell>
                        <TableCell className="font-medium">
                          {request.service}
                        </TableCell>
                        <TableCell className="text-sm">
                          {request.department}
                        </TableCell>
                        <TableCell className="font-semibold text-green-600">
                          {formatAmount(request.amount)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(request.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewDetails(request)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
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
                      Showing {((pagination.page - 1) * pagination.limit) + 1} of {pagination.total} result
                    </p>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant={currentPage === 1 ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                      >
                        1
                      </Button>
                      {pagination.pages > 1 && (
                        <Button
                          variant={currentPage === 2 ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(2)}
                        >
                          2
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        disabled={currentPage >= pagination.pages}
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

        {/* Approval Modal */}
        {showApprovalModal && selectedRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-blue-600">Procurement {'>>'} {selectedRequest.department}</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowApprovalModal(false)
                      setSelectedRequest(null)
                      setComment("")
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="px-6 py-4 overflow-y-auto flex-1">
                <div className="space-y-4">
                  {/* Request Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Invoice No:</p>
                      <p className="font-medium">{selectedRequest.invoice_id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Date:</p>
                      <p className="font-medium">{formatDate(selectedRequest.date)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Service:</p>
                      <p className="font-medium">{selectedRequest.service}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Department:</p>
                      <p className="font-medium">{selectedRequest.department}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Status:</p>
                      {getStatusBadge(selectedRequest.status)}
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Amount:</p>
                      <p className="font-medium text-green-600">{formatAmount(selectedRequest.amount)}</p>
                    </div>
                  </div>

                  {/* Requested by + Attachment */}
                  <div className="border-t pt-4 space-y-2">
                    <p className="text-sm text-gray-600">Requested by: {selectedRequest.requested_by}</p>
                    {selectedRequest.description && (
                      <div>
                        <p className="text-sm text-gray-600">Description:</p>
                        <p className="text-sm font-medium text-gray-900">{selectedRequest.description}</p>
                      </div>
                    )}
                    {selectedRequest.attachment_url && (
                      <button
                        onClick={() => setFileViewer({ url: selectedRequest.attachment_url!, name: selectedRequest.attachment_name || 'Attachment' })}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm text-left"
                      >
                        <Paperclip className="h-4 w-4" />
                        {selectedRequest.attachment_name || 'View Attachment'}
                      </button>
                    )}
                  </div>

                  {/* Review History - Show previous approvals */}
                  {(selectedRequest.dept_oversight_comment ||
                    selectedRequest.operations_comment ||
                    selectedRequest.executive_comment) && (
                    <div className="border-t pt-4 space-y-3">
                      <h4 className="text-sm font-semibold text-gray-700">Review History</h4>
                      {[
                        {
                          label: "Department Oversight",
                          comment: selectedRequest.dept_oversight_comment,
                          by: selectedRequest.dept_oversight_by,
                          at: selectedRequest.dept_oversight_at,
                        },
                        {
                          label: "Operations Desk",
                          comment: selectedRequest.operations_comment,
                          by: selectedRequest.operations_by,
                          at: selectedRequest.operations_at,
                        },
                        {
                          label: "Executive Desk",
                          comment: selectedRequest.executive_comment,
                          by: selectedRequest.executive_by,
                          at: selectedRequest.executive_at,
                        },
                      ]
                        .filter(stage => stage.comment || stage.by || stage.at)
                        .map(stage => (
                          <div key={stage.label} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <div className="text-xs font-semibold text-blue-600">{stage.label}</div>
                            {stage.comment && (
                              <p className="text-sm text-gray-700 mt-1">{stage.comment}</p>
                            )}
                            {(stage.by || stage.at) && (
                              <p className="text-xs text-gray-500 mt-2">
                                {stage.by
                                  ? `${stage.by.first_name || ''} ${stage.by.last_name || ''}`.trim() || stage.by.email
                                  : "Unknown"}{" "}
                                {stage.at ? `• ${new Date(stage.at).toLocaleDateString('en-GB')}` : ""}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Comment Section */}
                  <div className="border-t pt-4">
                    <label className="text-sm font-medium text-blue-600 mb-2 block">Your Comment</label>
                    <textarea
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-700 focus:border-transparent"
                      rows={3}
                      placeholder="Enter your comments..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="px-6 py-4 border-t flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowApprovalModal(false)
                    setSelectedRequest(null)
                    setComment("")
                  }}
                >
                  Cancel
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={rejectRequestMutation.isPending}
                  >
                    {rejectRequestMutation.isPending ? "Rejecting..." : "Reject"}
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={approveRequestMutation.isPending}
                    className="bg-[#BE1522] hover:bg-[#9B1219]"
                  >
                    {approveRequestMutation.isPending ? "Approving..." : "Approve"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {fileViewer && (
        <FileViewerModal
          url={fileViewer.url}
          name={fileViewer.name}
          isOpen={!!fileViewer}
          onClose={() => setFileViewer(null)}
        />
      )}
    </PermissionGate>
  )
}
