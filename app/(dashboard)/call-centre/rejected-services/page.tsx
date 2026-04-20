"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ArrowLeft,
  Search,
  Eye,
  RotateCcw,
  XCircle,
  MoreHorizontal,
  Calendar,
  User,
  Building,
  X,
  Trash2,
  Trash
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"

export const dynamic = 'force-dynamic'

interface RejectedService {
  id: string
  request_id: string
  enrollee_name: string
  enrollee_id: string
  provider_name: string
  hospital_name: string
  rejected_services: any[]
  rejected_amount: number
  amount?: number
  diagnosis?: string | null
  rejection_reason: string
  status: string
  created_at: string
  rejected_at: string
  provider: any
  enrollee: any
}

interface DeletedApprovalCode {
  id: string
  approval_code: string
  enrollee_name: string
  enrollee_id: string
  organization: string
  plan: string
  hospital: string
  services: string
  amount: number
  diagnosis: string | null
  status: string
  generated_by: string
  created_at: string
  deleted_at: string
  deleted_by: string
  deletion_reason: string
}

export default function RejectedServicesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedProvider, setSelectedProvider] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Modal states
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedService, setSelectedService] = useState<RejectedService | null>(null)

  // Deleted codes state
  const [activeTab, setActiveTab] = useState("rejected")
  const [deletedCodesPage, setDeletedCodesPage] = useState(1)
  const [showDeletedDetailModal, setShowDeletedDetailModal] = useState(false)
  const [selectedDeletedCode, setSelectedDeletedCode] = useState<DeletedApprovalCode | null>(null)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch rejected services
  const { data: rejectedServicesData, isLoading } = useQuery({
    queryKey: ["rejected-services", currentPage, limit, debouncedSearchTerm, selectedProvider],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(selectedProvider !== "all" && { provider: selectedProvider }),
      })

      const res = await fetch(`/api/call-centre/rejected-services?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch rejected services")
      }
      return res.json()
    },
  })

  // Fetch deleted approval codes
  const { data: deletedCodesData, isLoading: isLoadingDeleted } = useQuery({
    queryKey: ["deleted-approval-codes", deletedCodesPage, limit, debouncedSearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: deletedCodesPage.toString(),
        limit: limit.toString(),
        search: debouncedSearchTerm,
      })

      const res = await fetch(`/api/call-centre/approval-codes/deleted?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch deleted approval codes")
      }
      return res.json()
    },
    enabled: activeTab === "deleted"
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

  const rejectedServices = rejectedServicesData?.rejected_requests || []
  const pagination = rejectedServicesData?.pagination

  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  // Handle action clicks
  const handleViewDetails = (service: RejectedService) => {
    setSelectedService(service)
    setShowViewModal(true)
  }

  const handleViewDeletedDetails = (code: DeletedApprovalCode) => {
    setSelectedDeletedCode(code)
    setShowDeletedDetailModal(true)
  }

  // Handle retract action
  const handleRetract = async (serviceId: string) => {
    if (!confirm("Are you sure you want to retract this rejected request? This will move it back to Pending status.")) {
      return
    }

    try {
      const res = await fetch(`/api/call-centre/provider-requests/${serviceId}/retract`, {
        method: "POST",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to retract request")
      }

      toast({
        title: "Success",
        description: "Request retracted successfully",
      })

      // Refresh list
      queryClient.invalidateQueries({ queryKey: ["rejected-services"] })
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      })
    }
  }

  // Get action dropdown
  const getActionDropdown = (service: RejectedService) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handleViewDetails(service)}>
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleRetract(service.id || service.request_id)}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Retract Request
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <PermissionGate module="call-centre" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Rejected & Deleted Services</h1>
              <p className="text-gray-600">View history of rejected services and deleted approval codes</p>
            </div>
          </div>
        </div>

        {/* Tabs Control */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="rejected" className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Rejected Requests
            </TabsTrigger>
            <TabsTrigger value="deleted" className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Deleted Codes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rejected" className="space-y-6">

            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filter Rejected Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Provider</label>
                    <Select value={selectedProvider} onValueChange={(value) => {
                      setSelectedProvider(value)
                      handleFilterChange()
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Providers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Providers</SelectItem>
                        {providersData?.providers?.map((provider: any) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.facility_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">Search</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search by enrollee name or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rejected Services Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Rejected Services</CardTitle>
                    <CardDescription>Services that were rejected during the approval process</CardDescription>
                  </div>
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
                          <TableHead className="text-xs font-medium text-gray-600">ENROLLEE</TableHead>
                          <TableHead className="text-xs font-medium text-gray-600">ENROLLEE ID</TableHead>
                          <TableHead className="text-xs font-medium text-gray-600">PROVIDER NAME</TableHead>
                          <TableHead className="text-xs font-medium text-gray-600">REJECTED AMOUNT</TableHead>
                          <TableHead className="text-xs font-medium text-gray-600">STATUS</TableHead>
                          <TableHead className="text-xs font-medium text-gray-600">REMARKS</TableHead>
                          <TableHead className="text-xs font-medium text-gray-600">DATE & TIME</TableHead>
                          <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rejectedServices.map((service: RejectedService) => (
                          <TableRow key={service.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-gray-400" />
                                {service.enrollee_name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-sm">{service.enrollee_id}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4 text-gray-400" />
                                {service.provider_name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold text-red-600">₦{service.rejected_amount.toLocaleString()}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="destructive" className="bg-red-100 text-red-800">
                                <XCircle className="h-3 w-3 mr-1" />
                                Rejected
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600 max-w-xs">
                              <div className="truncate" title={service.rejection_reason || 'No remarks provided'}>
                                {service.rejection_reason || 'No remarks provided'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                {new Date(service.rejected_at || service.created_at).toLocaleString('en-GB')}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getActionDropdown(service)}
                            </TableCell>
                          </TableRow>
                        ))}
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
          </TabsContent>

          <TabsContent value="deleted" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-red-500" />
                  <div>
                    <CardTitle>Deleted Approval Codes</CardTitle>
                    <CardDescription>
                      {deletedCodesData?.pagination ? `${deletedCodesData.pagination.total} deleted code(s) found` : "View history of deleted codes with reasons"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingDeleted ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                  </div>
                ) : (deletedCodesData?.deleted_approval_codes || []).length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-gray-500">No deleted approval codes found</div>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs font-medium text-gray-600">APPROVAL CODE</TableHead>
                          <TableHead className="text-xs font-medium text-gray-600">ENROLLEE</TableHead>
                          <TableHead className="text-xs font-medium text-gray-600">HOSPITAL</TableHead>
                          <TableHead className="text-xs font-medium text-gray-600">AMOUNT</TableHead>
                          <TableHead className="text-xs font-medium text-gray-600">DELETED BY</TableHead>
                          <TableHead className="text-xs font-medium text-gray-600">REASON</TableHead>
                          <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                          <TableHead className="text-right text-xs font-medium text-gray-600">ACTIONS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deletedCodesData.deleted_approval_codes.map((code: DeletedApprovalCode) => (
                          <TableRow key={code.id}>
                            <TableCell className="font-mono text-sm">{code.approval_code}</TableCell>
                            <TableCell>
                              <div>
                                <span className="font-medium text-gray-900">{code.enrollee_name || "-"}</span>
                                <div className="text-xs text-gray-500">ID: {code.enrollee_id || "N/A"}</div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm max-w-[150px] truncate" title={code.hospital}>{code.hospital}</TableCell>
                            <TableCell className="text-sm font-semibold text-green-600">
                              ₦{code.amount.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-sm">{code.deleted_by}</TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate" title={code.deletion_reason}>
                              {code.deletion_reason}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500">
                              {code.deleted_at ? new Date(code.deleted_at).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewDeletedDetails(code)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Deleted Pagination */}
                    {deletedCodesData.pagination && (
                      <div className="flex items-center justify-between mt-4">
                        <p className="text-sm text-gray-600">
                          Showing {((deletedCodesData.pagination.page - 1) * deletedCodesData.pagination.limit) + 1} to {Math.min(deletedCodesData.pagination.page * deletedCodesData.pagination.limit, deletedCodesData.pagination.total)} of {deletedCodesData.pagination.total} results
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletedCodesPage(prev => Math.max(prev - 1, 1))}
                            disabled={deletedCodesData.pagination.page === 1}
                          >
                            Previous
                          </Button>
                          <span className="text-sm">
                            Page {deletedCodesData.pagination.page} of {deletedCodesData.pagination.pages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletedCodesPage(prev => Math.min(prev + 1, deletedCodesData.pagination.pages))}
                            disabled={deletedCodesData.pagination.page === deletedCodesData.pagination.pages}
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
          </TabsContent>
        </Tabs>

        {/* View Details Modal */}
        {showViewModal && selectedService && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-red-600">Rejected Service Details</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowViewModal(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  View details for rejected service request
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Service Information */}
                  <div>
                    <h3 className="text-red-600 font-semibold mb-4">Service Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Enrollee Name</label>
                        <p className="text-sm font-semibold">{selectedService.enrollee_name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Enrollee ID</label>
                        <p className="text-sm font-mono">{selectedService.enrollee_id}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Provider</label>
                        <p className="text-sm font-semibold">{selectedService.provider_name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Status</label>
                        <Badge variant="destructive" className="bg-red-100 text-red-800">
                          Rejected
                        </Badge>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Date & Time</label>
                        <p className="text-sm">{new Date(selectedService.created_at).toLocaleString('en-GB')}</p>
                      </div>
                      {selectedService.amount && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Amount</label>
                          <p className="text-sm font-semibold">₦{selectedService.amount.toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rejected Services Details */}
                  <div>
                    <h3 className="text-red-600 font-semibold mb-4">Rejected Services</h3>
                    <div className="space-y-3">
                      {selectedService.rejected_services && selectedService.rejected_services.length > 0 ? (
                        selectedService.rejected_services.map((service: any, index: number) => (
                          <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-red-800">{service.service_name || service.name}</p>
                                <p className="text-sm text-red-600">₦{service.amount?.toLocaleString() || '0'}</p>
                              </div>
                              <Badge variant="destructive" className="bg-red-100 text-red-800">
                                Rejected
                              </Badge>
                            </div>
                            {service.remarks && (
                              <div className="mt-2">
                                <p className="text-sm font-medium text-red-700">Rejection Reason:</p>
                                <p className="text-sm text-red-600">{service.remarks}</p>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <p className="text-sm text-gray-600">No rejected services details available</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Diagnosis */}
                  {selectedService.diagnosis && (
                    <div>
                      <h3 className="text-red-600 font-semibold mb-4">Diagnosis</h3>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <label className="text-sm font-medium text-gray-600">Diagnosis</label>
                        <p className="text-sm mt-1">{selectedService.diagnosis}</p>
                      </div>
                    </div>
                  )}

                  {/* Rejection Reason */}
                  {selectedService.rejection_reason && (
                    <div>
                      <h3 className="text-red-600 font-semibold mb-4">Rejection Information</h3>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <label className="text-sm font-medium text-red-600">Rejection Reason</label>
                        <p className="text-sm text-red-800 mt-1">{selectedService.rejection_reason}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Deleted Code View Details Modal */}
      <Dialog open={showDeletedDetailModal} onOpenChange={setShowDeletedDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Deleted Approval Code Details
            </DialogTitle>
            <DialogDescription>
              Full record of the deleted approval code and reasoning.
            </DialogDescription>
          </DialogHeader>
          {selectedDeletedCode && (
            <div className="space-y-6">
              {/* Deletion info banner */}
              <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Trash className="h-5 w-5 text-red-600 mt-1" />
                  <div>
                    <p className="text-sm font-semibold text-red-900">Deletion Reason</p>
                    <p className="text-sm text-red-800 mt-1">{selectedDeletedCode.deletion_reason}</p>
                    <div className="flex gap-4 mt-3 pt-3 border-t border-red-200">
                      <div>
                        <p className="text-xs font-medium text-red-600">Deleted By</p>
                        <p className="text-sm text-red-900 font-medium">{selectedDeletedCode.deleted_by}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-red-600">Date Deleted</p>
                        <p className="text-sm text-red-900 font-medium">
                          {new Date(selectedDeletedCode.deleted_at).toLocaleString('en-GB')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">Approval Code</label>
                  <p className="text-sm font-mono font-bold text-gray-900">{selectedDeletedCode.approval_code}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Status (Prior to Deletion)</label>
                  <p className="text-sm">
                    <Badge variant="outline" className="text-gray-600 border-gray-300">{selectedDeletedCode.status}</Badge>
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Enrollee</label>
                  <p className="text-sm font-semibold">{selectedDeletedCode.enrollee_name}</p>
                  <p className="text-xs text-gray-500">ID: {selectedDeletedCode.enrollee_id}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Hospital</label>
                  <p className="text-sm font-semibold">{selectedDeletedCode.hospital}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Total Amount</label>
                  <p className="text-sm font-bold text-green-600">₦{selectedDeletedCode.amount.toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Generated By</label>
                  <p className="text-sm">{selectedDeletedCode.generated_by || "System"}</p>
                </div>
              </div>

              {/* Diagnosis */}
              {selectedDeletedCode.diagnosis && (
                <div>
                  <label className="text-xs font-medium text-gray-500">Diagnosis</label>
                  <p className="text-sm p-3 bg-gray-50 rounded border">{selectedDeletedCode.diagnosis}</p>
                </div>
              )}

              {/* Services List */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">Services Breakdown</label>
                <div className="space-y-2">
                  {(() => {
                    try {
                      const parsed = JSON.parse(selectedDeletedCode.services || '[]')
                      if (Array.isArray(parsed)) {
                        return parsed.map((s: any, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-200">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{s.service_name || s.name}</p>
                              <p className="text-xs text-gray-500">Qty: {s.quantity || 1}</p>
                            </div>
                            <p className="text-sm font-bold text-gray-900">₦{parseFloat(s.amount || 0).toLocaleString()}</p>
                          </div>
                        ))
                      }
                    } catch (e) {
                      return <p className="text-sm italic text-gray-500">{selectedDeletedCode.services}</p>
                    }
                    return null
                  })()}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeletedDetailModal(false)}>Close</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PermissionGate>
  )
}
