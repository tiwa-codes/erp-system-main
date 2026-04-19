"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
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
  MoreHorizontal
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"

interface ProviderRequest {
  id: string
  date: string
  hospital: string
  claim_id: string
  services: string
  amount: number
  status: 'NEW' | 'PROCESSED' | 'PENDING'
  enrollee_id?: string
  enrollee_name?: string
  provider_id: string
  provider_name: string
}

export default function RequestsFromProviderPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedProvider, setSelectedProvider] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Modal states
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ProviderRequest | null>(null)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

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

  const requests = requestsData?.provider_requests || []
  const pagination = requestsData?.pagination
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
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleViewRequest = (request: ProviderRequest) => {
    setSelectedRequest(request)
    setShowViewModal(true)
  }

  const handleProcessRequest = async (request: ProviderRequest) => {
    if (window.confirm(`Are you sure you want to process request ${request.claim_id}?`)) {
      processRequestMutation.mutate(request.id)
    }
  }

  return (
    <PermissionGate module="call-centre" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Requests from Providers</h1>
            <p className="text-gray-600">Manage and process requests from healthcare providers</p>
          </div>
        </div>

        {/* Requests Table */}
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
                                View
                              </DropdownMenuItem>
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

        {/* View Request Modal */}
        {showViewModal && selectedRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Request Details</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowViewModal(false)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>Request #{selectedRequest.claim_id}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Request Information */}
                <div>
                  <h3 className="text-blue-600 font-semibold mb-4">Request Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Claim ID</label>
                      <p className="text-sm font-semibold">{selectedRequest.claim_id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Date</label>
                      <p className="text-sm">{new Date(selectedRequest.date).toLocaleDateString('en-GB')}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Hospital</label>
                      <p className="text-sm">{selectedRequest.hospital}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Status</label>
                      <Badge className={getStatusBadgeColor(selectedRequest.status)}>
                        {selectedRequest.status}
                      </Badge>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Amount</label>
                      <p className="text-sm font-semibold text-green-600">₦{selectedRequest.amount.toLocaleString()}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-600">Services</label>
                      <p className="text-sm">{selectedRequest.services}</p>
                    </div>
                  </div>
                </div>

                {/* Enrollee Information */}
                {selectedRequest.enrollee_name && (
                  <div>
                    <h3 className="text-blue-600 font-semibold mb-4">Enrollee Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Enrollee Name</label>
                        <p className="text-sm">{selectedRequest.enrollee_name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Enrollee ID</label>
                        <p className="text-sm font-mono">{selectedRequest.enrollee_id}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowViewModal(false)}
                  >
                    Close
                  </Button>
                  {selectedRequest.status === 'NEW' && (
                    <PermissionGate module="call-centre" action="edit">
                      <Button
                        onClick={() => {
                          setShowViewModal(false)
                          handleProcessRequest(selectedRequest)
                        }}
                        className="bg-[#BE1522] hover:bg-[#9B1219]"
                        disabled={processRequestMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Process Request
                      </Button>
                    </PermissionGate>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PermissionGate>
  )
}
